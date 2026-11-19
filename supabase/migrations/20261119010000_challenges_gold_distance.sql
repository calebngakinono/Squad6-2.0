-- Gold in the weekly tiers challenge: run 25 km, OR walk and hike 40 km (Caleb, 2026-11-18).
-- Before: 25 km of run or walk distance combined; hiking didn't count.
--
-- Distance goals are now a list in the challenge config ("distance_goals": key, activities, target in
-- metres). Gold is met when any ONE goal is met on its own: 15 km running plus 24 km walking is not gold.
-- Progress is stored per goal in challenge_participants.distance_m, e.g. {"run": 12000, "walk_hike": 31000}.
--
-- weekly-tiers-v1 is updated in place rather than replaced by a v2: this lands in the same release as
-- 20261118010000_challenges.sql, so no deployed database has anyone in it yet. If someone had joined, the
-- challenges_locked trigger would stop this migration instead of silently changing their rules.
--
-- destructive-ok: drops challenge_participants.validated_distance_m, replaced by distance_m. The column was
-- added by the previous migration of the same release and holds no data in any deployed database.

alter table public.challenge_participants
  add column distance_m jsonb not null default '{}'::jsonb;
comment on column public.challenge_participants.distance_m is
  'Validated distance in metres per distance goal key, e.g. {"run": 12000, "walk_hike": 31000}. Server-written.';
alter table public.challenge_participants drop column validated_distance_m;

drop function public.challenge_progress(uuid, date, timestamptz, uuid, text[]);
drop function public.my_challenges();

-- What counts for an athlete in a week: accepted workouts that started after they joined (and, for a
-- squad challenge, were done in that squad), and for each distance goal ({"key", "activities"}) the
-- validated distance of its activities. Manual distance never counts.
create function public.challenge_progress(target_user uuid, target_week date, since timestamptz, in_squad uuid,
                                          goals jsonb, out accepted_workouts int, out distance_m jsonb)
language sql
stable
set search_path = ''
as $$
  with counted as (
    select w.activity,
           case when ws.categories && array['location', 'platform_record']
                 and ws.detail ->> 'distance_source' in ('gps', 'healthkit', 'health_connect')
                then (ws.detail ->> 'distance_m')::numeric end as validated_m
    from public.workout_sessions w
    join public.workout_scores ws on ws.session_id = w.id
    where w.user_id = target_user
      and w.local_date between target_week and target_week + 6
      and w.started_at >= since
      and ws.status = 'accepted'
      and (in_squad is null or w.squad_id = in_squad)
  )
  select (select count(*)::int from counted),
         coalesce((select jsonb_object_agg(g ->> 'key',
                     (select coalesce(sum(c.validated_m), 0) from counted c
                      where c.activity = any (array(select jsonb_array_elements_text(g -> 'activities')))))
                   from jsonb_array_elements(coalesce(goals, '[]'::jsonb)) g), '{}'::jsonb)
$$;

-- A squad's position in one week of a squad challenge.
--   roster:    members when the week started (each member's own home-time-zone Monday 00:00). Locked:
--              someone who joins mid-week is not counted, and someone who leaves still is (so removing
--              members can't lower the bar).
--   required:  share of the roster, rounded up.
--   qualified: participants from the roster with enough accepted workouts done in this squad.
create or replace function public.challenge_squad_status(target_challenge text, target_squad uuid, target_week date,
                                              out roster int, out required int, out qualified int)
language plpgsql
stable
set search_path = ''
as $$
declare
  cfg jsonb;
begin
  select c.config into cfg from public.challenges c where c.id = target_challenge;

  select count(distinct m.user_id)::int into roster
    from public.squad_members m
    left join public.profile_private pp on pp.user_id = m.user_id
    where m.squad_id = target_squad
      and public.challenge_in_squad_at(m.user_id, target_squad,
            target_week::timestamp at time zone coalesce(pp.home_timezone, 'UTC'));

  required := (roster * (cfg ->> 'share_num')::int + (cfg ->> 'share_den')::int - 1) / (cfg ->> 'share_den')::int;

  select count(*)::int into qualified
    from public.challenge_participants p
    where p.challenge_id = target_challenge and p.squad_id = target_squad and p.week_start = target_week
      and public.challenge_in_squad_at(p.user_id, p.squad_id, p.week_starts_at)
      and (select x.accepted_workouts from public.challenge_progress(p.user_id, p.week_start, p.joined_at, p.squad_id, '[]'::jsonb) x)
          >= (cfg ->> 'workouts_each')::int;
end;
$$;

-- Bring one athlete's challenge awards for one week in line with the facts. Idempotent: running it
-- again writes nothing unless something changed. The ledger gets:
--   * an 'award' row the first time a tier is paid (a higher tier pays the top-up to its value),
--   * an 'adjustment' row when the amount owed changes later (a counted workout was rejected, or the
--     weekly cap moved), never an edit.
create or replace function public.challenge_reconcile(target_user uuid, target_week date, on_date date)
returns void
language plpgsql
set search_path = ''
as $$
declare
  active_rule text := public.challenge_active_rule();
  room int := (public.challenge_limits() ->> 'weekly_cap')::int;
  ledger_date date := least(greatest(on_date, target_week), target_week + 6);
  p record;
  cfg jsonb;
  t jsonb;
  done_workouts int;
  done_m jsonb;
  met boolean;
  sq record;
  reached text;
  reached_points int;
  deserved int;
  paid int;
  diff int;
  take int;
  src record;
  award_id uuid;
  rows_before int;
  revisions int;
begin
  if active_rule is null then
    return; -- scoring is switched off: challenges award nothing
  end if;
  perform pg_advisory_xact_lock(hashtextextended('challenge:' || target_user::text || ':' || target_week::text, 0));

  for p in
    select cp.*, c.kind, c.title, c.config
    from public.challenge_participants cp
    join public.challenges c on c.id = cp.challenge_id
    where cp.user_id = target_user and cp.week_start = target_week
    order by c.sort_order, cp.joined_at, cp.id
  loop
    cfg := p.config;
    reached := null;
    reached_points := 0;

    if p.kind = 'individual_tiered' then
      select x.accepted_workouts, x.distance_m into done_workouts, done_m
        from public.challenge_progress(p.user_id, p.week_start, p.joined_at, null, cfg -> 'distance_goals') x;
      for t in select * from jsonb_array_elements(cfg -> 'tiers') loop
        -- 'distance_goal' is met when any one goal is met on its own (no mixing of activities).
        met := case t ->> 'measure'
          when 'accepted_workouts' then done_workouts >= (t ->> 'target')::int
          when 'distance_goal' then exists (
            select 1 from jsonb_array_elements(coalesce(cfg -> 'distance_goals', '[]'::jsonb)) g
            where coalesce((done_m ->> (g ->> 'key'))::numeric, 0) >= (g ->> 'target')::numeric)
          else false end;
        if met and (t ->> 'points')::int > reached_points then
          reached := t ->> 'tier';
          reached_points := (t ->> 'points')::int;
        end if;
      end loop;
    else -- squad_participation
      select x.accepted_workouts, x.distance_m into done_workouts, done_m
        from public.challenge_progress(p.user_id, p.week_start, p.joined_at, p.squad_id, '[]'::jsonb) x;
      if p.squad_id is not null then
        select * into sq from public.challenge_squad_status(p.challenge_id, p.squad_id, p.week_start);
        if done_workouts >= (cfg ->> 'workouts_each')::int
           and public.challenge_in_squad_at(p.user_id, p.squad_id, p.week_starts_at)
           and sq.roster >= (cfg ->> 'min_roster')::int
           and sq.qualified >= sq.required then
          reached := cfg ->> 'tier';
          reached_points := (cfg ->> 'points')::int;
        end if;
      end if;
    end if;

    -- The weekly cap, applied in a fixed order (sort_order, then join time).
    deserved := least(reached_points, room);
    room := room - deserved;

    update public.challenge_participants set
      accepted_workouts = done_workouts, distance_m = coalesce(done_m, '{}'::jsonb), tier = reached, evaluated_at = now()
    where id = p.id;

    if reached is not null then
      insert into public.challenge_awards (participant_id, tier, tier_points, rule_version)
      values (p.id, reached, reached_points, active_rule)
      on conflict (participant_id, tier) do nothing;
    end if;

    select coalesce(sum(l.points), 0)::int into paid
      from public.points_ledger l
      join public.challenge_awards a on a.id = l.source_id
      where l.source_type = 'challenge' and a.participant_id = p.id;
    diff := deserved - paid;

    if diff > 0 then
      -- Pay (or top up) onto the tier reached now.
      select a.id into award_id from public.challenge_awards a where a.participant_id = p.id and a.tier = reached;
      select count(*)::int, count(*) filter (where l.kind = 'adjustment')::int into rows_before, revisions
        from public.points_ledger l where l.source_type = 'challenge' and l.source_id = award_id;
      insert into public.points_ledger (user_id, squad_id, season, local_date, source_type, source_id, rule_version, kind, revision, points, reason)
      values (
        p.user_id, p.squad_id, extract(year from ledger_date)::int, ledger_date, 'challenge', award_id, active_rule,
        case when rows_before = 0 then 'award' else 'adjustment' end,
        case when rows_before = 0 then 0 else revisions + 1 end,
        diff,
        format('%s: %s reached', p.title, reached)
          || case when paid > 0 then ' (tops up what was already paid this week)' else '' end
          || case when deserved < reached_points then ' (weekly challenge cap of 250 reached)' else '' end);
    elsif diff < 0 then
      -- Take back, highest tier first: a counted workout no longer counts, or the cap moved.
      for src in
        select a.id, a.tier, (select coalesce(sum(l.points), 0)::int from public.points_ledger l
                              where l.source_type = 'challenge' and l.source_id = a.id) as on_tier
        from public.challenge_awards a where a.participant_id = p.id
        order by a.tier_points desc
      loop
        exit when diff = 0;
        continue when src.on_tier <= 0;
        take := greatest(diff, -src.on_tier);
        select count(*) filter (where l.kind = 'adjustment')::int into revisions
          from public.points_ledger l where l.source_type = 'challenge' and l.source_id = src.id;
        insert into public.points_ledger (user_id, squad_id, season, local_date, source_type, source_id, rule_version, kind, revision, points, reason)
        values (
          p.user_id, p.squad_id, extract(year from ledger_date)::int, ledger_date, 'challenge', src.id, active_rule,
          'adjustment', revisions + 1, take,
          format('%s: re-checked after a counted workout changed', p.title));
        diff := diff - take;
      end loop;
    end if;
  end loop;
end;
$$;

-- This week's challenges for the signed-in athlete: rules, whether they joined, progress and tier as the
-- server last computed them, points actually paid (from the ledger), and their squad's position.
create function public.my_challenges()
returns table (
  challenge_id text,
  kind text,
  title text,
  description text,
  config jsonb,
  week_start date,
  week_ends_at timestamptz,
  join_closes_at timestamptz,
  joined boolean,
  join_blocked text,
  joined_next_week boolean,
  accepted_workouts int,
  distance_m jsonb,
  tier text,
  points int,
  squad_roster int,
  squad_required int,
  squad_qualified int,
  scoring_on boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  lim jsonb := public.challenge_limits();
  tz text;
  wk date;
  starts timestamptz;
  ends timestamptz;
  closes timestamptz;
  my_squad uuid;
  joined_count int;
  c public.challenges;
  p public.challenge_participants;
  roster_n int;
  required_n int;
  qualified_n int;
  blocked text;
begin
  select pp.home_timezone into tz from public.profile_private pp where pp.user_id = uid;
  if tz is null then
    return; -- not set up yet
  end if;
  wk := public.challenge_week_start((now() at time zone tz)::date);
  starts := wk::timestamp at time zone tz;
  ends := (wk + 7)::timestamp at time zone tz;
  closes := starts + (ends - starts) * (lim ->> 'join_window')::float8;
  select m.squad_id into my_squad from public.squad_members m where m.user_id = uid and m.left_at is null;
  select count(*)::int into joined_count from public.challenge_participants x where x.user_id = uid and x.week_start = wk;

  for c in
    select * from public.challenges ch
    where ch.available_from <= wk and (ch.available_until is null or ch.available_until >= wk)
    order by ch.sort_order, ch.id
  loop
    select * into p from public.challenge_participants x where x.challenge_id = c.id and x.user_id = uid and x.week_start = wk;

    blocked := case
      when p.id is not null then null
      when c.kind = 'squad_participation' and my_squad is null then 'not_in_squad'
      when c.kind = 'squad_participation' and not public.challenge_in_squad_at(uid, my_squad, starts) then 'joined_squad_mid_week'
      when now() > closes then 'join_window_closed'
      when joined_count >= (lim ->> 'max_per_week')::int then 'too_many_challenges'
    end;

    roster_n := null;
    required_n := null;
    qualified_n := null;
    if c.kind = 'squad_participation' and coalesce(p.squad_id, my_squad) is not null then
      select s.roster, s.required, s.qualified into roster_n, required_n, qualified_n
        from public.challenge_squad_status(c.id, coalesce(p.squad_id, my_squad), wk) s;
    end if;

    challenge_id := c.id;
    kind := c.kind;
    title := c.title;
    description := c.description;
    config := c.config;
    week_start := wk;
    week_ends_at := coalesce(p.week_ends_at, ends);
    join_closes_at := closes;
    joined := p.id is not null;
    join_blocked := blocked;
    joined_next_week := exists (select 1 from public.challenge_participants x
                                where x.challenge_id = c.id and x.user_id = uid and x.week_start = wk + 7);
    accepted_workouts := coalesce(p.accepted_workouts, 0);
    distance_m := coalesce(p.distance_m, '{}'::jsonb);
    tier := p.tier;
    points := (select coalesce(sum(l.points), 0)::int from public.points_ledger l
               join public.challenge_awards a on a.id = l.source_id
               where l.source_type = 'challenge' and a.participant_id = p.id);
    squad_roster := roster_n;
    squad_required := required_n;
    squad_qualified := qualified_n;
    scoring_on := public.challenge_active_rule() is not null;
    return next;
  end loop;
end;
$$;

update public.challenges set
  description = 'Bronze: 3 accepted workouts. Silver: 5 accepted workouts. Gold: run 25 km, or walk and hike 40 km, measured by GPS or a health app. You earn your highest tier only.',
  config = '{
    "distance_goals": [
      {"key": "run", "activities": ["run"], "target": 25000},
      {"key": "walk_hike", "activities": ["walk", "hike"], "target": 40000}
    ],
    "tiers": [
      {"tier": "bronze", "points": 40, "measure": "accepted_workouts", "target": 3},
      {"tier": "silver", "points": 80, "measure": "accepted_workouts", "target": 5},
      {"tier": "gold", "points": 120, "measure": "distance_goal"}
    ]
  }'
where id = 'weekly-tiers-v1';

revoke all on function
  public.challenge_progress(uuid, date, timestamptz, uuid, jsonb),
  public.my_challenges()
from public, anon, authenticated;
grant execute on function public.my_challenges() to authenticated;

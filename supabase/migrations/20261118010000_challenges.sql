-- Official challenges, core MVP types (docs/scoring-proposal.md §5, approved by Caleb on 2026-11-10).
--
--   Weekly tiers (individual): Bronze 3 accepted workouts (40) · Silver 5 accepted workouts (80) ·
--                              Gold 25 km of validated run/walk distance (120). Highest tier only.
--   Squad week (squad):        at least 2/3 (rounded up) of the members who were in the squad when the
--                              week started each complete 3 accepted workouts → 60 per member who did.
--
-- How it works, in plain terms:
--   * There is no scheduler. A challenge is a versioned template that runs every week. "This week" is the
--     athlete's own Monday-to-Sunday week in their home time zone, the same time zone that already decides
--     a workout's scoring day (locked when the workout starts).
--   * Athletes press Join. They can join before a week starts ("next week") or during its first 25 %
--     (Monday 00:00 to Tuesday 18:00, local time). Only workouts STARTED after joining count.
--     At most 3 official challenges per athlete per week.
--   * Progress and awards are worked out inside Postgres, right after the scorer has scored a workout's
--     day (on finish, on late evidence, and when an operator accepts or rejects a workout in review).
--     Nothing is calculated on the phone.
--   * Only workouts with the scoring outcome `accepted` count. Distance counts only when it came from
--     passing GPS (location category) or an auto-recorded health-app workout (platform record). Manual
--     distance never counts.
--   * Every award is a points_ledger row (source_type 'challenge') whose source is a challenge_awards row:
--     one per participant and tier, so a tier can never be paid twice. Reaching a higher tier tops up to
--     its value. If a counted workout is later rejected, a reversing adjustment row brings it back down.
--   * Challenge points are capped at 250 per athlete per week, on the server.
--   * When scoring is switched off in an environment (no active rule version), challenges award nothing.
--   * The ledger row carries the athlete's squad (at join), so squad challenge points count toward the
--     squad's score exactly like workout points (squad_standings sums the ledger).
--
-- Deferred (not in this migration): activity-specific, squad collective km, seasonal/monthly events,
-- ranked city events, Pro custom challenges, leaving a challenge.

-- 1. Tables -------------------------------------------------------------------------------------

-- A challenge template. Changing a running challenge means adding a new row (a new id), never editing
-- one that athletes have joined (enforced below).
create table public.challenges (
  id text primary key check (id ~ '^[a-z0-9-]{3,60}$'),
  kind text not null check (kind in ('individual_tiered', 'squad_participation')),
  title text not null check (char_length(title) between 1 and 60),
  description text not null check (char_length(description) between 1 and 400),
  config jsonb not null,
  -- The first and last week (a Monday) it runs. Null = keeps running.
  available_from date not null check (extract(isodow from available_from) = 1),
  available_until date check (available_until is null or extract(isodow from available_until) = 1),
  -- Display order, and the order the weekly cap is applied in.
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.challenges is
  'Official challenge templates (weekly). Versioned: a joined challenge''s rules are never edited.';

-- An athlete's entry in one week of one challenge, with the progress the server last computed.
create table public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id text not null references public.challenges (id),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The Monday the week starts on, and the week's exact span in the athlete's home time zone (locked at join).
  week_start date not null check (extract(isodow from week_start) = 1),
  home_timezone text not null,
  week_starts_at timestamptz not null,
  week_ends_at timestamptz not null,
  joined_at timestamptz not null,
  -- The athlete's squad when they joined. Squad challenge: the squad they compete with.
  -- Both kinds: the squad the points count for.
  squad_id uuid references public.squads (id) on delete set null,
  -- Progress (server-written only).
  accepted_workouts int not null default 0,
  validated_distance_m numeric not null default 0,
  tier text,
  evaluated_at timestamptz,
  unique (challenge_id, user_id, week_start),
  check (week_ends_at > week_starts_at)
);

comment on table public.challenge_participants is
  'Who joined which week of which challenge, and their server-computed progress. Owner-only.';

create index challenge_participants_user_week on public.challenge_participants (user_id, week_start);
create index challenge_participants_squad_week on public.challenge_participants (challenge_id, squad_id, week_start);

-- Each tier a participant reached. It is the source of the ledger rows that pay it, so the ledger's
-- unique key makes a second payment for the same tier impossible.
create table public.challenge_awards (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.challenge_participants (id) on delete cascade,
  tier text not null,
  -- The tier's full value. What was actually paid (top-ups, the weekly cap, reversals) is in the ledger.
  tier_points int not null check (tier_points > 0),
  rule_version text not null references public.scoring_rule_versions (version),
  reached_at timestamptz not null default now(),
  unique (participant_id, tier)
);

comment on table public.challenge_awards is
  'Challenge tiers reached; each is the source of its points_ledger rows. Owner-only; written by the server.';

-- 2. Access: read-only for clients ---------------------------------------------------------------

alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.challenge_awards enable row level security;

create policy "challenges: signed-in users can read"
  on public.challenges for select to authenticated using (true);

create policy "challenge_participants: owner can read"
  on public.challenge_participants for select to authenticated using (user_id = (select auth.uid()));

create policy "challenge_awards: owner can read"
  on public.challenge_awards for select to authenticated
  using (exists (select 1 from public.challenge_participants p where p.id = participant_id and p.user_id = (select auth.uid())));

revoke all on public.challenges, public.challenge_participants, public.challenge_awards from anon, authenticated;
grant select on public.challenges, public.challenge_participants, public.challenge_awards to authenticated;

-- A joined challenge's rules are locked.
create function public.challenges_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (old.id, old.kind, old.config, old.available_from) is distinct from (new.id, new.kind, new.config, new.available_from)
     and exists (select 1 from public.challenge_participants p where p.challenge_id = old.id) then
    raise exception 'challenge_locked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger challenges_locked
  before update on public.challenges
  for each row execute function public.challenges_locked();

-- 3. The MVP challenges ---------------------------------------------------------------------------

insert into public.challenges (id, kind, title, description, config, available_from, sort_order) values
(
  'weekly-tiers-v1', 'individual_tiered', 'Weekly tiers',
  'Bronze: 3 accepted workouts. Silver: 5 accepted workouts. Gold: 25 km of run or walk distance measured by GPS or a health app. You earn your highest tier only.',
  '{
    "distance_activities": ["run", "walk"],
    "tiers": [
      {"tier": "bronze", "points": 40, "measure": "accepted_workouts", "target": 3},
      {"tier": "silver", "points": 80, "measure": "accepted_workouts", "target": 5},
      {"tier": "gold", "points": 120, "measure": "validated_distance_m", "target": 25000}
    ]
  }',
  '2025-12-29', 1
),
(
  'squad-week-v1', 'squad_participation', 'Squad week',
  'At least two thirds of your squad (counted when the week starts, rounded up) each complete 3 accepted workouts. Everyone who did earns 60 points.',
  '{"tier": "complete", "points": 60, "workouts_each": 3, "share_num": 2, "share_den": 3, "min_roster": 2}',
  '2025-12-29', 2
);

-- 4. Helpers --------------------------------------------------------------------------------------

-- Limits that apply to all official challenges (scoring-proposal §5).
create function public.challenge_limits()
returns jsonb
language sql
immutable
set search_path = ''
as $$ select '{"weekly_cap": 250, "join_window": 0.25, "max_per_week": 3}'::jsonb $$;

-- The Monday of the week a date falls in.
create function public.challenge_week_start(d date)
returns date
language sql
immutable
set search_path = ''
as $$ select d - (extract(isodow from d)::int - 1) $$;

-- The rule version that is switched on right now; null when scoring is off.
create function public.challenge_active_rule()
returns text
language sql
stable
set search_path = ''
as $$
  select v.version from public.scoring_rule_versions v
  where v.active_from <= now() order by v.active_from desc limit 1
$$;

-- What counts for an athlete in a week: accepted workouts that started after they joined (and, for a
-- squad challenge, were done in that squad), and the validated distance of the listed activities.
create function public.challenge_progress(target_user uuid, target_week date, since timestamptz, in_squad uuid,
                                          activities text[], out accepted_workouts int, out validated_distance_m numeric)
language sql
stable
set search_path = ''
as $$
  select count(*)::int,
         coalesce(sum(case
           when w.activity = any (activities)
            and ws.categories && array['location', 'platform_record']
            and ws.detail ->> 'distance_source' in ('gps', 'healthkit', 'health_connect')
           then (ws.detail ->> 'distance_m')::numeric end), 0)
  from public.workout_sessions w
  join public.workout_scores ws on ws.session_id = w.id
  where w.user_id = target_user
    and w.local_date between target_week and target_week + 6
    and w.started_at >= since
    and ws.status = 'accepted'
    and (in_squad is null or w.squad_id = in_squad)
$$;

-- Was the athlete a member of the squad at that moment?
create function public.challenge_in_squad_at(target_user uuid, target_squad uuid, at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.squad_members m
    where m.squad_id = target_squad and m.user_id = target_user
      and m.joined_at <= at and (m.left_at is null or m.left_at > at))
$$;

-- A squad's position in one week of a squad challenge.
--   roster:    members when the week started (each member's own home-time-zone Monday 00:00). Locked:
--              someone who joins mid-week is not counted, and someone who leaves still is (so removing
--              members can't lower the bar).
--   required:  share of the roster, rounded up.
--   qualified: participants from the roster with enough accepted workouts done in this squad.
create function public.challenge_squad_status(target_challenge text, target_squad uuid, target_week date,
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
      and (select x.accepted_workouts from public.challenge_progress(p.user_id, p.week_start, p.joined_at, p.squad_id, '{}') x)
          >= (cfg ->> 'workouts_each')::int;
end;
$$;

-- 5. Evaluation -----------------------------------------------------------------------------------

-- Bring one athlete's challenge awards for one week in line with the facts. Idempotent: running it
-- again writes nothing unless something changed. The ledger gets:
--   * an 'award' row the first time a tier is paid (a higher tier pays the top-up to its value),
--   * an 'adjustment' row when the amount owed changes later (a counted workout was rejected, or the
--     weekly cap moved), never an edit.
create function public.challenge_reconcile(target_user uuid, target_week date, on_date date)
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
  done_m numeric;
  measured numeric;
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
      select x.accepted_workouts, x.validated_distance_m into done_workouts, done_m
        from public.challenge_progress(p.user_id, p.week_start, p.joined_at, null,
               array(select jsonb_array_elements_text(cfg -> 'distance_activities'))) x;
      for t in select * from jsonb_array_elements(cfg -> 'tiers') loop
        measured := case t ->> 'measure' when 'accepted_workouts' then done_workouts::numeric
                                      when 'validated_distance_m' then done_m end;
        if measured >= (t ->> 'target')::numeric and (t ->> 'points')::int > reached_points then
          reached := t ->> 'tier';
          reached_points := (t ->> 'points')::int;
        end if;
      end loop;
    else -- squad_participation
      select x.accepted_workouts, x.validated_distance_m into done_workouts, done_m
        from public.challenge_progress(p.user_id, p.week_start, p.joined_at, p.squad_id, '{}') x;
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
      accepted_workouts = done_workouts, validated_distance_m = coalesce(done_m, 0), tier = reached, evaluated_at = now()
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

-- Re-evaluate everything a scored day can affect: the athlete's own challenges that week and, for a
-- squad challenge, every squadmate in it (the 2/3 rule depends on all of them).
create function public.challenge_evaluate(target_user uuid, target_date date)
returns void
language plpgsql
set search_path = ''
as $$
declare
  wk date := public.challenge_week_start(target_date);
  sq record;
  mate record;
begin
  if public.challenge_active_rule() is null
     or not exists (select 1 from public.challenge_participants p where p.user_id = target_user and p.week_start = wk) then
    return;
  end if;

  -- Lock each squad-week first, always in the same order, so two squadmates finishing at once queue up.
  for sq in
    select distinct p.challenge_id, p.squad_id
    from public.challenge_participants p
    join public.challenges c on c.id = p.challenge_id
    where p.user_id = target_user and p.week_start = wk and c.kind = 'squad_participation' and p.squad_id is not null
    order by p.challenge_id, p.squad_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('challenge-squad:' || sq.challenge_id || ':' || sq.squad_id::text || ':' || wk::text, 0));
  end loop;

  perform public.challenge_reconcile(target_user, wk, target_date);

  for mate in
    select distinct p2.user_id
    from public.challenge_participants p
    join public.challenges c on c.id = p.challenge_id
    join public.challenge_participants p2
      on p2.challenge_id = p.challenge_id and p2.squad_id = p.squad_id and p2.week_start = p.week_start
    where p.user_id = target_user and p.week_start = wk and c.kind = 'squad_participation'
      and p2.user_id <> target_user
    order by p2.user_id
  loop
    perform public.challenge_reconcile(mate.user_id, wk, target_date);
  end loop;
end;
$$;

-- Hook into the scorer. score_day() is what every scoring path calls (finish, late evidence, review),
-- so it becomes: score the workouts of the day (the existing function, renamed), then the challenges.
-- A later migration that changes workout scoring replaces score_workouts_of_day().
alter function public.score_day(uuid, date) rename to score_workouts_of_day;

create function public.score_day(target_user uuid, target_date date)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.score_workouts_of_day(target_user, target_date);
  perform public.challenge_evaluate(target_user, target_date);
end;
$$;

-- 6. Joining ----------------------------------------------------------------------------------------
-- Errors: challenge_not_found, invalid_week, timezone_required, challenge_not_running,
-- join_window_closed, too_many_challenges, not_in_squad, joined_squad_mid_week.

-- The rules of joining, with the time passed in (so tests can check the 25 % window exactly).
create function public.challenge_join_at(target_user uuid, target_challenge text, which_week text, at timestamptz)
returns public.challenge_participants
language plpgsql
set search_path = ''
as $$
declare
  c public.challenges;
  lim jsonb := public.challenge_limits();
  tz text;
  wk date;
  starts timestamptz;
  ends timestamptz;
  squad uuid;
  existing public.challenge_participants;
  result public.challenge_participants;
begin
  if which_week is null or which_week not in ('current', 'next') then
    raise exception 'invalid_week' using errcode = 'P0001';
  end if;
  select * into c from public.challenges ch where ch.id = target_challenge;
  if c.id is null then
    raise exception 'challenge_not_found' using errcode = 'P0001';
  end if;
  select pp.home_timezone into tz from public.profile_private pp where pp.user_id = target_user;
  if tz is null then
    raise exception 'timezone_required' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('challenge-join:' || target_user::text, 0));

  wk := public.challenge_week_start((at at time zone tz)::date) + case when which_week = 'next' then 7 else 0 end;
  if wk < c.available_from or (c.available_until is not null and wk > c.available_until) then
    raise exception 'challenge_not_running' using errcode = 'P0001';
  end if;

  -- Joining twice returns the existing entry.
  select * into existing from public.challenge_participants p
    where p.challenge_id = c.id and p.user_id = target_user and p.week_start = wk;
  if existing.id is not null then
    return existing;
  end if;

  starts := wk::timestamp at time zone tz;
  ends := (wk + 7)::timestamp at time zone tz;
  if at > starts + (ends - starts) * (lim ->> 'join_window')::float8 then
    raise exception 'join_window_closed' using errcode = 'P0001';
  end if;
  if (select count(*) from public.challenge_participants p where p.user_id = target_user and p.week_start = wk)
     >= (lim ->> 'max_per_week')::int then
    raise exception 'too_many_challenges' using errcode = 'P0001';
  end if;

  select m.squad_id into squad from public.squad_members m where m.user_id = target_user and m.left_at is null;
  if c.kind = 'squad_participation' then
    if squad is null then
      raise exception 'not_in_squad' using errcode = 'P0001';
    end if;
    -- Only members who were in the squad when the week started take part.
    if not public.challenge_in_squad_at(target_user, squad, starts) then
      raise exception 'joined_squad_mid_week' using errcode = 'P0001';
    end if;
  end if;

  insert into public.challenge_participants
    (challenge_id, user_id, week_start, home_timezone, week_starts_at, week_ends_at, joined_at, squad_id)
  values (c.id, target_user, wk, tz, starts, ends, at, squad)
  returning * into result;
  return result;
end;
$$;

-- The app's Join button: this week (if still open) or next week.
create function public.join_challenge(challenge text, week text default 'current')
returns public.challenge_participants
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.challenge_join_at(public.require_user_uid(), join_challenge.challenge, join_challenge.week, now());
end;
$$;

-- 7. What the app shows ---------------------------------------------------------------------------
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
  validated_distance_m numeric,
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
    validated_distance_m := coalesce(p.validated_distance_m, 0);
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

-- 8. Permissions ----------------------------------------------------------------------------------

revoke all on function
  public.challenges_locked(),
  public.challenge_limits(),
  public.challenge_week_start(date),
  public.challenge_active_rule(),
  public.challenge_progress(uuid, date, timestamptz, uuid, text[]),
  public.challenge_in_squad_at(uuid, uuid, timestamptz),
  public.challenge_squad_status(text, uuid, date),
  public.challenge_reconcile(uuid, date, date),
  public.challenge_evaluate(uuid, date),
  public.score_day(uuid, date),
  public.score_workouts_of_day(uuid, date),
  public.challenge_join_at(uuid, text, text, timestamptz),
  public.join_challenge(text, text),
  public.my_challenges()
from public, anon, authenticated;

grant execute on function public.join_challenge(text, text), public.my_challenges() to authenticated;

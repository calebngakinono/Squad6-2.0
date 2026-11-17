-- Scoring engine, part 1: rule versions, the evaluator and the points ledger.
-- Implements rule v1 from docs/scoring-proposal.md (approved 2026-11-10).
--
--   Workout points = Base (170, only if eligible) + Verification (0-30) + Performance (0-50)
--
-- Everything is computed on the server from stored measurements. The phone never sends points.
-- Scoring is OFF until a rule version is switched on (active_from), per environment, by an operator:
-- production competitive scoring needs Caleb's sign-off (CLAUDE.md hard rule 10).

-- 1. Tables -----------------------------------------------------------------------------------

create table public.scoring_rule_versions (
  version text primary key check (version ~ '^v[0-9]+$'),
  config jsonb not null,
  -- Workouts that start at or after this moment are scored with this version. Null = not switched on.
  active_from timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.scoring_rule_versions is
  'Versioned scoring rules. Changing a rule means adding a version, never editing one that has scored workouts.';

-- The outcome for each finished workout, with the breakdown the summary screen shows.
create table public.workout_scores (
  session_id uuid primary key references public.workout_sessions (id) on delete cascade,
  rule_version text not null references public.scoring_rule_versions (version),
  -- accepted: earns points. recorded: kept as history, earns 0 (too short, no evidence, or third+ of the day).
  -- needs_review: failed a plausibility check, earns 0 until reviewed. merged: counted inside another workout.
  status text not null check (status in ('accepted', 'recorded', 'needs_review', 'merged')),
  merged_into uuid references public.workout_sessions (id) on delete set null,
  categories text[] not null default '{}',
  base int not null default 0,
  verification int not null default 0,
  performance int not null default 0,
  -- Daily schedule: 1 for the day's first scored workout, 0.5 for the second, 0 after that.
  factor numeric(3, 2) not null default 0,
  total int not null default 0 check (total >= 0),
  -- Plain facts behind the numbers: active minutes, distance used and where it came from, reasons.
  detail jsonb not null default '{}',
  scored_at timestamptz not null default now()
);

comment on table public.workout_scores is 'Server-computed scoring outcome per workout. Owner-only; written only by the scorer.';

-- Every point ever awarded or taken back. Append-only: corrections are new rows, never edits.
create table public.points_ledger (
  id bigint generated always as identity primary key,
  -- Null after account deletion: the row stays (it affects the squad's total) but points at no person.
  user_id uuid references public.profiles (id) on delete set null,
  squad_id uuid references public.squads (id) on delete set null,
  season int not null,
  local_date date not null,
  source_type text not null check (source_type in ('workout', 'challenge')),
  source_id uuid not null,
  rule_version text not null references public.scoring_rule_versions (version),
  kind text not null check (kind in ('award', 'adjustment')),
  -- 0 for the award; 1, 2, ... for later adjustments to the same source.
  revision int not null default 0 check (revision >= 0),
  points int not null check (points <> 0),
  reason text not null,
  created_at timestamptz not null default now(),
  check ((kind = 'award') = (revision = 0)),
  check (kind <> 'award' or points > 0),
  -- A source can be awarded once per rule version; each adjustment has its own number.
  unique (source_type, source_id, rule_version, kind, revision)
);

comment on table public.points_ledger is
  'Append-only point awards and adjustments. Totals are always derived from these rows.';

create index points_ledger_user_season on public.points_ledger (user_id, season);
create index points_ledger_squad_season on public.points_ledger (squad_id, season);
create index points_ledger_source on public.points_ledger (source_type, source_id);

-- 2. Access: read-only for clients ---------------------------------------------------------------

alter table public.scoring_rule_versions enable row level security;
alter table public.workout_scores enable row level security;
alter table public.points_ledger enable row level security;

create policy "scoring_rule_versions: signed-in users can read"
  on public.scoring_rule_versions for select to authenticated using (true);

create policy "workout_scores: owner can read"
  on public.workout_scores for select to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

create policy "points_ledger: owner can read"
  on public.points_ledger for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.scoring_rule_versions, public.workout_scores, public.points_ledger from anon, authenticated;
grant select on public.scoring_rule_versions, public.workout_scores, public.points_ledger to authenticated;

-- 3. Rule v1 (docs/scoring-proposal.md) ----------------------------------------------------------
-- Not switched on: active_from stays null until an operator calls set_scoring_active().

insert into public.scoring_rule_versions (version, config) values ('v1', '{
  "base": 170,
  "verification": [0, 15, 25, 30],
  "effort": {"max": 30, "from_min": 20, "to_min": 60},
  "intensity_max": 20,
  "min_active_min": {"default": 20, "hiit": 15},
  "categories": {
    "location": {"min_coverage": 0.7},
    "motion": {"min_coverage": 0.6},
    "heart_rate": {"min_coverage": 0.7, "min_range_bpm": 5},
    "platform_record": {"min_overlap": 0.8},
    "live_set_log": {"min_sets": 6, "min_spread": 0.6, "gap_min_s": 20, "gap_max_s": 600, "max_sets_per_60s": 3}
  },
  "intensity": {
    "run": {"zero": 8.0, "full": 4.5, "min_km": 2},
    "walk": {"zero": 4, "full": 7},
    "hike": {"zero": 4, "full": 7},
    "cycle": {"zero": 15, "full": 32},
    "swim": {"zero": 3.5, "full": 1.75},
    "strength": {"zero": 8, "full": 24}
  },
  "plausibility": {
    "max_avg_speed_kmh": {"run": 25, "walk": 12, "hike": 12, "cycle": 60},
    "max_excluded_share": 0.2
  },
  "daily": [1.0, 0.5],
  "merge_gap_min": 120
}');

-- 4. Evaluator ---------------------------------------------------------------------------------

-- 0 below `zero`, 1 above `full`, straight line between. Works for "lower is better" too (zero > full).
create function public.scoring_ramp(x numeric, zero numeric, full_at numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$ select greatest(0, least(1, (x - zero) / (full_at - zero))) $$;

-- The facts about one finished workout that scoring needs: which evidence categories pass, the
-- validated distance (if any), live sets, and any plausibility problem.
create function public.workout_scoring_facts(target uuid, cfg jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  s public.workout_sessions;
  cat jsonb := cfg -> 'categories';
  gps_cov numeric;
  gps_dist numeric;
  gps_excluded numeric;
  gps_mocked numeric;
  motion_cov numeric;
  ev public.workout_evidence;
  hr_cov numeric;
  categories text[] := '{}'::text[];
  notes text[] := '{}'::text[];
  distance numeric;
  distance_source text;
  sets_n int := 0;
  sets_first timestamptz;
  sets_last timestamptz;
  gaps_ok int;
  gaps_all int;
  burst int;
  speed_kmh numeric;
  speed_limit numeric;
  issue text;
begin
  select * into s from public.workout_sessions where id = target;

  select max(value) filter (where metric = 'gps_coverage'), max(value) filter (where metric = 'distance_m'),
         max(value) filter (where metric = 'gps_excluded_m'), max(value) filter (where metric = 'gps_mocked_points')
    into gps_cov, gps_dist, gps_excluded, gps_mocked
    from public.workout_metrics where session_id = target and source = 'gps';
  select max(value) into motion_cov
    from public.workout_metrics where session_id = target and source = 'pedometer' and metric = 'motion_coverage';
  select * into ev from public.workout_evidence where session_id = target order by overlap desc limit 1;
  if ev.id is not null then
    select max(value) into hr_cov from public.workout_metrics
      where session_id = target and source = ev.provider and metric = 'hr_coverage';
  end if;

  -- Location: enough GPS coverage and not a single mocked fix.
  if gps_cov is not null then
    if coalesce(gps_mocked, 0) > 0 then
      notes := array_append(notes, 'Location did not count: the phone reported simulated GPS.');
    elsif gps_cov >= (cat -> 'location' ->> 'min_coverage')::numeric then
      categories := array_append(categories, 'location');
    else
      notes := array_append(notes, 'Location did not count: GPS covered too little of the workout.');
    end if;
  end if;

  -- Motion: steps during enough of the active time.
  if motion_cov is not null then
    if motion_cov >= (cat -> 'motion' ->> 'min_coverage')::numeric then
      categories := array_append(categories, 'motion');
    else
      notes := array_append(notes, 'Motion did not count: steps covered too little of the workout.');
    end if;
  end if;

  -- Heart rate: enough coverage, and values that vary (a constant reading is not a heartbeat).
  if hr_cov is not null then
    if hr_cov >= (cat -> 'heart_rate' ->> 'min_coverage')::numeric
       and ev.hr_max - ev.hr_min >= (cat -> 'heart_rate' ->> 'min_range_bpm')::numeric then
      categories := array_append(categories, 'heart_rate');
    else
      notes := array_append(notes, 'Heart rate did not count: too few readings, or readings that never changed.');
    end if;
  end if;

  -- Platform record: an auto-recorded workout from another app covering most of this one.
  -- (Hand-typed and own records were already refused when the evidence was attached.)
  if ev.id is not null then
    if ev.overlap >= (cat -> 'platform_record' ->> 'min_overlap')::numeric then
      categories := array_append(categories, 'platform_record');
    else
      notes := array_append(notes, 'The health-app workout did not count: it covered too little of this workout.');
    end if;
  end if;

  -- Live set log (scoring-proposal §1.2.1): enough sets, spread over the workout, with a real rhythm.
  select count(*), min(effective_at), max(effective_at) into sets_n, sets_first, sets_last
    from public.strength_sets where session_id = target and deleted_at is null and not after_finish;
  if sets_n > 0 then
    select count(*) filter (where gap between (cat -> 'live_set_log' ->> 'gap_min_s')::numeric
                                          and (cat -> 'live_set_log' ->> 'gap_max_s')::numeric), count(*)
      into gaps_ok, gaps_all
      from (select extract(epoch from effective_at - lag(effective_at) over (order by effective_at, id)) as gap
            from public.strength_sets where session_id = target and deleted_at is null and not after_finish) g
      where gap is not null;
    select coalesce(max(n), 0) into burst
      from (select (select count(*) from public.strength_sets b
                    where b.session_id = target and b.deleted_at is null and not b.after_finish
                      and b.effective_at >= a.effective_at and b.effective_at < a.effective_at + interval '60 seconds') as n
            from public.strength_sets a
            where a.session_id = target and a.deleted_at is null and not a.after_finish) w;

    if sets_n < (cat -> 'live_set_log' ->> 'min_sets')::int then
      notes := array_append(notes, 'The set log did not count: fewer than 6 sets were logged during the workout.');
    elsif extract(epoch from sets_last - sets_first) < (cat -> 'live_set_log' ->> 'min_spread')::numeric * s.active_seconds then
      notes := array_append(notes, 'The set log did not count: sets were logged in a small part of the workout.');
    elsif burst > (cat -> 'live_set_log' ->> 'max_sets_per_60s')::int or gaps_ok * 2 <= gaps_all then
      notes := array_append(notes, 'The set log did not count: sets were logged too close together to count as live.');
    else
      categories := array_append(categories, 'live_set_log');
    end if;
  end if;

  -- Distance counts only when it is validated: phone GPS that passed, else an accepted platform record.
  if 'location' = any (categories) and gps_dist is not null then
    distance := gps_dist;
    distance_source := 'gps';
  elsif 'platform_record' = any (categories) and ev.distance_m is not null then
    distance := ev.distance_m;
    distance_source := ev.provider;
  end if;

  -- Plausibility: failing one sends the workout to review instead of scoring it.
  speed_limit := (cfg -> 'plausibility' -> 'max_avg_speed_kmh' ->> s.activity)::numeric;
  if distance is not null and speed_limit is not null and s.active_seconds > 0 then
    speed_kmh := distance / s.active_seconds * 3.6;
    if speed_kmh > speed_limit then
      issue := format('Average speed of %s km/h is too fast for this activity.', round(speed_kmh));
    end if;
  end if;
  if issue is null and distance_source = 'gps' and gps_excluded > 0
     and gps_excluded / (gps_dist + gps_excluded) > (cfg -> 'plausibility' ->> 'max_excluded_share')::numeric then
    issue := 'The GPS track has large jumps.';
  end if;

  return jsonb_build_object(
    'session_id', s.id, 'activity', s.activity, 'started_at', s.started_at, 'ended_at', s.ended_at,
    'active_seconds', coalesce(s.active_seconds, 0), 'categories', to_jsonb(categories), 'notes', to_jsonb(notes),
    'distance_m', distance, 'distance_source', distance_source,
    'live_sets', case when 'live_set_log' = any (categories) then sets_n else 0 end,
    'issue', issue);
end;
$$;

-- Performance (0-50) = effort (0-30, active minutes 20 → 60) + intensity (0-20, activity-specific,
-- validated measurements only). HIIT, yoga, indoor cardio and "other" have no intensity measure yet
-- (vigorous minutes need per-minute heart rate or motion intensity, which is not collected yet).
create function public.scoring_performance(cfg jsonb, activity text, active_seconds numeric, distance_m numeric, live_sets int,
                                           out effort numeric, out intensity numeric)
language plpgsql
immutable
set search_path = ''
as $$
declare
  minutes numeric := active_seconds / 60;
  r jsonb := cfg -> 'intensity' -> activity;
  km numeric := distance_m / 1000;
  share numeric := 0;
begin
  effort := (cfg -> 'effort' ->> 'max')::numeric * public.scoring_ramp(
    least(minutes, (cfg -> 'effort' ->> 'to_min')::numeric),
    (cfg -> 'effort' ->> 'from_min')::numeric, (cfg -> 'effort' ->> 'to_min')::numeric);

  if r is not null and minutes > 0 then
    if activity = 'run' and km >= (r ->> 'min_km')::numeric then
      share := public.scoring_ramp(minutes / km, (r ->> 'zero')::numeric, (r ->> 'full')::numeric); -- minutes per km
    elsif activity in ('walk', 'hike', 'cycle') and km > 0 then
      share := public.scoring_ramp(km / minutes * 60, (r ->> 'zero')::numeric, (r ->> 'full')::numeric); -- km per hour
    elsif activity = 'swim' and distance_m > 0 then
      share := public.scoring_ramp(minutes / (distance_m / 100), (r ->> 'zero')::numeric, (r ->> 'full')::numeric); -- minutes per 100 m
    elsif activity = 'strength' then
      share := public.scoring_ramp(live_sets, (r ->> 'zero')::numeric, (r ->> 'full')::numeric);
    end if;
  end if;
  intensity := (cfg ->> 'intensity_max')::numeric * coalesce(share, 0);
end;
$$;

-- Score (or re-score) one athlete's day. Idempotent: running it again changes nothing unless the
-- underlying facts changed, in which case the ledger gets an adjustment row for the difference.
--
-- Daily rules (scoring-proposal §3): a workout of the same activity that starts less than 2 hours after
-- the previous workout ended is merged into it and scored once; then the day's first scored workout
-- gets 100 %, the second 50 %, later ones 0.
create function public.score_day(target_user uuid, target_date date)
returns void
language plpgsql
set search_path = ''
as $$
declare
  rule public.scoring_rule_versions;
  cfg jsonb;
  s public.workout_sessions;
  f jsonb;
  groups jsonb := '[]'::jsonb;
  g jsonb;
  last jsonb;
  last_idx int;
  mergeable boolean;
  member jsonb;
  anchor public.workout_sessions;
  active_s numeric;
  min_minutes numeric;
  cats text[];
  n_cats int;
  eff numeric;
  inten numeric;
  base_pts int;
  verif_pts int;
  perf_pts int;
  factor numeric;
  total int;
  status text;
  why text;
  rank int := 0;
  already int;
  revisions int;
  i int;
begin
  perform pg_advisory_xact_lock(hashtextextended('score:' || target_user::text, 0));

  -- 1. Collect the day's finished workouts in start order and merge back-to-back ones.
  for s in
    select w.* from public.workout_sessions w
    where w.user_id = target_user and w.local_date = target_date and w.state in ('submitted', 'accepted', 'needs_review')
    order by w.started_at, w.id
  loop
    select * into rule from public.scoring_rule_versions v
      where v.active_from <= s.started_at order by v.active_from desc limit 1;
    continue when rule.version is null; -- scoring was not switched on when this workout started
    f := public.workout_scoring_facts(s.id, rule.config) || jsonb_build_object('rule', rule.version);

    -- Only a workout that could score on its own (has evidence, no plausibility problem) is merged, and
    -- only into the last such workout of the day. So an empty session can neither wipe out a real
    -- workout's points nor be slipped between two halves to stop them merging.
    mergeable := jsonb_array_length(f -> 'categories') > 0 and f ->> 'issue' is null;
    last := case when last_idx is not null then groups -> last_idx end;
    if mergeable and last is not null
       and last ->> 'activity' = s.activity and last ->> 'rule' = rule.version
       and s.started_at - (last ->> 'ended_at')::timestamptz < make_interval(mins => (rule.config ->> 'merge_gap_min')::int) then
      groups := jsonb_set(groups, array[last_idx::text], last || jsonb_build_object(
        'ended_at', greatest(s.ended_at, (last ->> 'ended_at')::timestamptz), 'members', (last -> 'members') || jsonb_build_array(f)));
    else
      groups := groups || jsonb_build_array(jsonb_build_object(
        'activity', s.activity, 'rule', rule.version, 'ended_at', s.ended_at, 'members', jsonb_build_array(f)));
      if mergeable then
        last_idx := jsonb_array_length(groups) - 1;
      end if;
    end if;
  end loop;

  -- 2. Score each group and write the outcome.
  for g in select * from jsonb_array_elements(groups) loop
    select * into rule from public.scoring_rule_versions where version = g ->> 'rule';
    cfg := rule.config;
    select * into anchor from public.workout_sessions where id = (g -> 'members' -> 0 ->> 'session_id')::uuid;

    select sum((m ->> 'active_seconds')::numeric) into active_s from jsonb_array_elements(g -> 'members') m;
    -- A category counts for a merged workout only if every part has it.
    select array_agg(c order by c) into cats
      from jsonb_array_elements_text(g -> 'members' -> 0 -> 'categories') c
      where not exists (select 1 from jsonb_array_elements(g -> 'members') m where not (m -> 'categories') ? c);
    cats := coalesce(cats, '{}');
    n_cats := cardinality(cats);
    min_minutes := coalesce((cfg -> 'min_active_min' ->> anchor.activity)::numeric, (cfg -> 'min_active_min' ->> 'default')::numeric);

    base_pts := 0; verif_pts := 0; perf_pts := 0; factor := 0; total := 0; why := null; eff := null; inten := null;
    select m ->> 'issue' into why from jsonb_array_elements(g -> 'members') m where m ->> 'issue' is not null limit 1;

    if why is not null then
      status := 'needs_review';
    elsif active_s < min_minutes * 60 then
      status := 'recorded';
      why := format('Active time was under the %s-minute minimum.', min_minutes);
    elsif n_cats = 0 then
      status := 'recorded';
      why := 'No evidence besides the timer, so this workout is saved but earns no points.';
    else
      rank := rank + 1;
      factor := coalesce((cfg -> 'daily' ->> (rank - 1))::numeric, 0);
      base_pts := (cfg ->> 'base')::int;
      verif_pts := (cfg -> 'verification' ->> least(n_cats, jsonb_array_length(cfg -> 'verification') - 1))::int;
      select p.effort, p.intensity into eff, inten from public.scoring_performance(
        cfg, anchor.activity, active_s,
        -- Distance counts only if every part of the workout has a validated distance.
        case when exists (select 1 from jsonb_array_elements(g -> 'members') m where m ->> 'distance_m' is null) then null
             else (select sum((m ->> 'distance_m')::numeric) from jsonb_array_elements(g -> 'members') m) end,
        (select sum((m ->> 'live_sets')::int) from jsonb_array_elements(g -> 'members') m)::int) p;
      perf_pts := round(eff + inten);
      total := round((base_pts + verif_pts + perf_pts) * factor);
      if factor = 0 then
        status := 'recorded';
        why := 'Third or later workout of the day: saved, but only the first two earn points.';
      else
        status := 'accepted';
      end if;
    end if;

    i := 0;
    for member in select * from jsonb_array_elements(g -> 'members') loop
      insert into public.workout_scores as ws
        (session_id, rule_version, status, merged_into, categories, base, verification, performance, factor, total, detail)
      values (
        (member ->> 'session_id')::uuid, rule.version,
        case when i = 0 then status else 'merged' end,
        case when i = 0 then null else anchor.id end,
        case when i = 0 then cats else '{}' end,
        case when i = 0 then base_pts else 0 end,
        case when i = 0 then verif_pts else 0 end,
        case when i = 0 then perf_pts else 0 end,
        case when i = 0 then factor else 0 end,
        case when i = 0 then total else 0 end,
        case when i = 0 then jsonb_strip_nulls(jsonb_build_object(
          'active_minutes', round(active_s / 60, 1),
          'merged_workouts', jsonb_array_length(g -> 'members'),
          'effort', round(eff, 2), 'intensity', round(inten, 2),
          'distance_m', (select sum((m ->> 'distance_m')::numeric) from jsonb_array_elements(g -> 'members') m),
          'distance_source', g -> 'members' -> 0 ->> 'distance_source',
          'live_sets', (select sum((m ->> 'live_sets')::int) from jsonb_array_elements(g -> 'members') m),
          'reason', why,
          'notes', member -> 'notes'))
        else jsonb_build_object('reason', 'Counted together with the workout just before it (same activity, less than 2 hours apart).',
                                'notes', member -> 'notes') end)
      on conflict (session_id) do update set
        rule_version = excluded.rule_version, status = excluded.status, merged_into = excluded.merged_into,
        categories = excluded.categories, base = excluded.base, verification = excluded.verification,
        performance = excluded.performance, factor = excluded.factor, total = excluded.total, detail = excluded.detail,
        scored_at = case when (ws.status, ws.total, ws.categories) is distinct from (excluded.status, excluded.total, excluded.categories)
                         then now() else ws.scored_at end;

      -- Ledger: bring this workout's awarded points in line with what it should have now.
      select s2.* into s from public.workout_sessions s2 where s2.id = (member ->> 'session_id')::uuid;
      select coalesce(sum(points), 0), count(*) filter (where kind = 'adjustment') into already, revisions
        from public.points_ledger where source_type = 'workout' and source_id = s.id and rule_version = rule.version;
      if (case when i = 0 then total else 0 end) <> already then
        insert into public.points_ledger (user_id, squad_id, season, local_date, source_type, source_id, rule_version, kind, revision, points, reason)
        values (
          s.user_id, s.squad_id, extract(year from s.local_date)::int, s.local_date, 'workout', s.id, rule.version,
          case when already = 0 and revisions = 0 and i = 0 then 'award' else 'adjustment' end,
          case when already = 0 and revisions = 0 and i = 0 then 0 else revisions + 1 end,
          (case when i = 0 then total else 0 end) - already,
          case when already = 0 and revisions = 0 and i = 0 then 'Workout scored'
               else 'Re-scored: evidence or the day''s other workouts changed' end);
      end if;
      i := i + 1;
    end loop;
  end loop;
end;
$$;

-- 5. When scoring runs ---------------------------------------------------------------------------
-- At the finish, and again whenever measurements or evidence for a finished workout change (late
-- uploads, Apple Health sync). The 24-hour limits on those uploads bound how long a score can move.
--
-- The trigger functions are security definer because a deferred trigger runs at commit as the calling
-- app user, who (rightly) has no permission to run the scorer. They cannot be called directly.
--
-- These triggers are deferred to the end of the transaction, so the scorer always sees the complete
-- picture (all metrics written) and the ledger gets one award, not an award plus instant corrections.

create function public.score_workout_day(target uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  s public.workout_sessions;
begin
  select * into s from public.workout_sessions where id = target;
  if s.id is not null and s.state in ('submitted', 'accepted', 'needs_review') then
    perform public.score_day(s.user_id, s.local_date);
  end if;
end;
$$;

create function public.workout_score_on_finish()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.score_workout_day(new.id);
  return null;
end;
$$;

create constraint trigger workout_score_on_finish
  after update of state on public.workout_sessions
  deferrable initially deferred
  for each row
  when (new.state = 'submitted' and old.state in ('active', 'paused'))
  execute function public.workout_score_on_finish();

create function public.workout_score_on_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.score_workout_day(new.session_id);
  return null;
end;
$$;

create constraint trigger workout_metrics_rescore
  after insert or update on public.workout_metrics
  deferrable initially deferred
  for each row
  execute function public.workout_score_on_change();

-- 6. Switching scoring on (operators only) -------------------------------------------------------
-- Run per environment, e.g.  select public.set_scoring_active('v1', now());
-- Never callable by app users. Production: only with Caleb's sign-off.
create function public.set_scoring_active(target_version text, starting timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.scoring_rule_versions set active_from = starting where version = target_version;
  if not found then
    raise exception 'unknown_rule_version' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function
  public.scoring_ramp(numeric, numeric, numeric),
  public.workout_scoring_facts(uuid, jsonb),
  public.scoring_performance(jsonb, text, numeric, numeric, int),
  public.score_day(uuid, date),
  public.score_workout_day(uuid),
  public.workout_score_on_finish(),
  public.workout_score_on_change(),
  public.set_scoring_active(text, timestamptz)
from public, anon, authenticated;

-- Workout review: a person decides what happens to a workout the automatic checks flagged.
--
-- A flagged workout (status needs_review) earns 0 points until someone reviews it; it is never
-- accepted automatically (Caleb's decision, 2026-11-11). A reviewer can also reject any scored workout.
-- Decisions are append-only and the latest one wins, so a ruling can be reversed; the points follow
-- through ordinary ledger adjustment rows.
--
-- There is no in-app admin screen yet: reviews are done by an operator in the SQL editor
-- (docs/deployment.md). Nothing here is callable by app users, and reviewers never see a route:
-- the review list shows summaries only.

-- 1. Decisions ---------------------------------------------------------------------------------

create table public.workout_reviews (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  decision text not null check (decision in ('accepted', 'rejected')),
  -- Shown to the athlete when the workout is rejected.
  reason text not null check (char_length(btrim(reason)) between 3 and 300),
  -- Who decided (a name; operators have no app account).
  reviewer text not null check (char_length(btrim(reviewer)) between 1 and 60),
  decided_at timestamptz not null default now()
);

comment on table public.workout_reviews is
  'Append-only review decisions on workouts; the latest per workout wins. Written by operators only.';

create index workout_reviews_session on public.workout_reviews (session_id, id desc);

alter table public.workout_reviews enable row level security;

create policy "workout_reviews: owner can read"
  on public.workout_reviews for select to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

revoke all on public.workout_reviews from anon, authenticated;
grant select (session_id, decision, reason, decided_at) on public.workout_reviews to authenticated;

-- 2. A rejected outcome --------------------------------------------------------------------------

alter table public.workout_scores drop constraint workout_scores_status_check;
alter table public.workout_scores add constraint workout_scores_status_check
  check (status in ('accepted', 'recorded', 'needs_review', 'merged', 'rejected'));

-- 3. The scorer honours the latest decision -------------------------------------------------------
-- Same function as in the scoring-engine migration, plus: a rejected workout earns 0 and stands alone;
-- an accepted one skips the plausibility check and is scored like any other.

create or replace function public.score_day(target_user uuid, target_date date)
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
  review record;
  rejected_why text;
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

    -- A person's latest decision on this workout overrides the automatic checks.
    select r.decision, r.reason into review from public.workout_reviews r where r.session_id = s.id order by r.id desc limit 1;
    if review.decision = 'rejected' then
      f := f || jsonb_build_object('rejected', review.reason);
    elsif review.decision = 'accepted' then
      f := (f - 'issue') || jsonb_build_object('notes', (f -> 'notes') || '["Reviewed and accepted by Squad Six."]'::jsonb);
    end if;

    -- Only a workout that could score on its own (has evidence, no plausibility problem) is merged, and
    -- only into the last such workout of the day. So an empty session can neither wipe out a real
    -- workout's points nor be slipped between two halves to stop them merging.
    mergeable := jsonb_array_length(f -> 'categories') > 0 and f ->> 'issue' is null and not f ? 'rejected';
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

    select m ->> 'rejected' into rejected_why from jsonb_array_elements(g -> 'members') m where m ? 'rejected' limit 1;

    if rejected_why is not null then
      status := 'rejected';
      why := 'Reviewed by Squad Six and not counted: ' || rejected_why;
    elsif why is not null then
      status := 'needs_review';
      why := why || ' It earns no points until a person at Squad Six has reviewed it.';
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


-- 4. Operator tools ------------------------------------------------------------------------------

-- What needs a decision, oldest first. Summaries only: no coordinates.
create view public.workouts_awaiting_review
with (security_invoker = true) as
select
  ws.session_id,
  s.local_date,
  p.display_name as athlete,
  s.activity,
  round(s.active_seconds / 60.0, 1) as active_minutes,
  ws.detail ->> 'reason' as flagged_because,
  (select round(m.value / 1000, 2) from public.workout_metrics m
    where m.session_id = s.id and m.metric = 'distance_m' and m.source = 'gps') as gps_km,
  (select round(m.value / 1000, 2) from public.workout_metrics m
    where m.session_id = s.id and m.metric = 'gps_excluded_m') as gps_km_thrown_out,
  (select m.value from public.workout_metrics m
    where m.session_id = s.id and m.metric = 'gps_coverage') as gps_coverage,
  (select m.value from public.workout_metrics m
    where m.session_id = s.id and m.metric = 'steps') as steps,
  (select e.source_name from public.workout_evidence e where e.session_id = s.id order by e.overlap desc limit 1) as health_app_source,
  ws.scored_at as flagged_at
from public.workout_scores ws
join public.workout_sessions s on s.id = ws.session_id
left join public.profiles p on p.id = s.user_id
where ws.status = 'needs_review'
order by ws.scored_at;

revoke all on public.workouts_awaiting_review from public, anon, authenticated;

-- Record a decision and re-score the athlete's day.
--   select public.review_workout('<session id>', 'accepted', 'Checked the route, it is a real ride', 'Caleb');
create function public.review_workout(target uuid, decision text, reason text, reviewer text)
returns public.workout_scores
language plpgsql
set search_path = ''
as $$
declare
  s public.workout_sessions;
  result public.workout_scores;
begin
  select * into s from public.workout_sessions where id = target;
  if s.id is null or not exists (select 1 from public.workout_scores ws where ws.session_id = target) then
    raise exception 'workout_not_scored' using errcode = 'P0001';
  end if;
  insert into public.workout_reviews (session_id, decision, reason, reviewer)
  values (target, review_workout.decision, btrim(review_workout.reason), btrim(review_workout.reviewer));
  perform public.score_day(s.user_id, s.local_date);
  select * into result from public.workout_scores where session_id = target;
  return result;
end;
$$;

revoke all on function public.review_workout(uuid, text, text, text) from public, anon, authenticated;

-- Live workout engine, part 4: evidence from health platforms (Apple Health now, Health Connect later).
-- See docs/health-integrations.md.
--
-- After a workout, the phone looks in Apple Health for a workout recorded by another app or a watch
-- during the same time, and attaches a summary of it here as evidence. Only derived summaries are
-- stored (no raw heart-rate samples, no routes). Whether evidence earns anything is decided later by
-- the scoring engine; this migration only records it honestly.

-- 1. Table ------------------------------------------------------------------------------------

create table public.workout_evidence (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  provider text not null check (provider in ('healthkit', 'health_connect')),
  -- The platform's own id for the workout (HealthKit UUID).
  external_record_id text not null check (char_length(external_record_id) between 1 and 100),
  source_name text check (char_length(source_name) <= 100),
  source_bundle_id text not null check (char_length(source_bundle_id) between 1 and 200),
  device_name text check (char_length(device_name) <= 100),
  activity text check (char_length(activity) <= 60),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  -- Share of the Squad Six workout (start to finish) that this record covers. Computed by the server.
  overlap numeric(4, 3) not null check (overlap > 0 and overlap <= 1),
  distance_m numeric(9, 1) check (distance_m between 0 and 1000000),
  energy_kcal numeric(7, 1) check (energy_kcal between 0 and 20000),
  hr_samples int check (hr_samples >= 0),
  -- Minutes of the overlapping time that have at least one heart-rate sample.
  hr_minutes int check (hr_minutes between 0 and 720),
  hr_min numeric(4, 1) check (hr_min between 25 and 250),
  hr_avg numeric(4, 1) check (hr_avg between 25 and 250),
  hr_max numeric(4, 1) check (hr_max between 25 and 250),
  received_at timestamptz not null default now(),
  check (ended_at > started_at),
  -- One platform workout can back only one Squad Six workout, ever.
  unique (provider, external_record_id),
  -- And a workout takes one record per platform.
  unique (session_id, provider)
);

comment on table public.workout_evidence is
  'Summaries of health-platform workouts attached as evidence (provenance: synced). Owner-only.';

alter table public.workout_evidence enable row level security;

create policy "workout_evidence: owner can read"
  on public.workout_evidence for select to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

revoke all on public.workout_evidence from anon, authenticated;
grant select on public.workout_evidence to authenticated;

-- 2. More metric names --------------------------------------------------------------------------

alter table public.workout_metrics drop constraint workout_metrics_metric_check;
alter table public.workout_metrics add constraint workout_metrics_metric_check check (metric in (
  'distance_m', 'gps_coverage', 'gps_points', 'gps_mocked_points', 'gps_excluded_m', 'steps', 'motion_coverage',
  'avg_heart_rate', 'max_heart_rate', 'hr_coverage', 'active_energy_kcal', 'platform_overlap'));

-- 3. Attach ------------------------------------------------------------------------------------
-- Errors (SQLSTATE P0001): workout_not_found, workout_not_finished, evidence_window_closed,
-- invalid_evidence, manual_record, own_record, no_overlap, evidence_already_used, evidence_already_attached.

-- evidence: { provider, id, source_name?, bundle_id, device_name?, activity?, start, end, user_entered,
--             distance_m?, energy_kcal?, hr_samples?, hr_minutes?, hr_min?, hr_avg?, hr_max? }
create function public.attach_workout_evidence(session_id uuid, evidence jsonb)
returns public.workout_evidence
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  s public.workout_sessions;
  e record;
  existing public.workout_evidence;
  covered numeric;
  result public.workout_evidence;
begin
  select * into s from public.workout_sessions w where w.id = attach_workout_evidence.session_id and w.user_id = uid for update;
  if s.id is null then
    raise exception 'workout_not_found' using errcode = 'P0001';
  end if;
  if s.state not in ('submitted', 'accepted', 'needs_review', 'rejected') then
    raise exception 'workout_not_finished' using errcode = 'P0001';
  end if;
  -- Watches can take hours to sync, so evidence is accepted for 24 hours after the finish.
  if s.ended_at < now() - interval '24 hours' then
    raise exception 'evidence_window_closed' using errcode = 'P0001';
  end if;

  begin
    select * into strict e from jsonb_to_record(evidence) as r (
      provider text, id text, source_name text, bundle_id text, device_name text, activity text,
      "start" timestamptz, "end" timestamptz, user_entered boolean,
      distance_m numeric, energy_kcal numeric, hr_samples int, hr_minutes int, hr_min numeric, hr_avg numeric, hr_max numeric);
  exception when others then
    raise exception 'invalid_evidence' using errcode = 'P0001';
  end;
  if e.provider is null or e.id is null or e.bundle_id is null or e.start is null or e."end" is null or e.user_entered is null then
    raise exception 'invalid_evidence' using errcode = 'P0001';
  end if;

  -- Typed in by hand, or written by Squad Six itself: not independent evidence.
  if e.user_entered then
    raise exception 'manual_record' using errcode = 'P0001';
  end if;
  if lower(e.bundle_id) = 'com.squadsix.app' then
    raise exception 'own_record' using errcode = 'P0001';
  end if;

  select * into existing from public.workout_evidence x where x.provider = e.provider and x.external_record_id = e.id;
  if existing.id is not null then
    if existing.session_id = s.id then
      return existing; -- retried request
    end if;
    raise exception 'evidence_already_used' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.workout_evidence x where x.session_id = s.id and x.provider = e.provider) then
    raise exception 'evidence_already_attached' using errcode = 'P0001';
  end if;

  covered := extract(epoch from least(e."end", s.ended_at) - greatest(e.start, s.started_at));
  if covered is null or covered <= 0 or s.ended_at <= s.started_at then
    raise exception 'no_overlap' using errcode = 'P0001';
  end if;

  begin
    insert into public.workout_evidence
      (session_id, provider, external_record_id, source_name, source_bundle_id, device_name, activity, started_at, ended_at,
       overlap, distance_m, energy_kcal, hr_samples, hr_minutes, hr_min, hr_avg, hr_max)
    values (s.id, e.provider, e.id, left(e.source_name, 100), e.bundle_id, left(e.device_name, 100), left(e.activity, 60),
            e.start, e."end",
            least(1, round(covered / extract(epoch from s.ended_at - s.started_at), 3)),
            e.distance_m, e.energy_kcal, e.hr_samples, e.hr_minutes, e.hr_min, e.hr_avg, e.hr_max)
    returning * into result;
  exception when check_violation or not_null_violation or data_exception then
    raise exception 'invalid_evidence' using errcode = 'P0001';
  end;

  -- The summary's measurements, labeled with where they came from.
  insert into public.workout_metrics (session_id, metric, value, source, provenance)
  select s.id, x.metric, x.value, result.provider, 'synced'
  from (values
    ('platform_overlap', result.overlap),
    ('distance_m', result.distance_m),
    ('active_energy_kcal', result.energy_kcal),
    ('avg_heart_rate', result.hr_avg),
    ('max_heart_rate', result.hr_max),
    ('hr_coverage', case when result.hr_minutes is not null
       then round(least(1, result.hr_minutes * 60 / extract(epoch from s.ended_at - s.started_at)), 3) end)
  ) as x (metric, value)
  where x.value is not null
  on conflict on constraint workout_metrics_pkey do update set value = excluded.value, computed_at = now();

  return result;
end;
$$;

revoke all on function public.attach_workout_evidence(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.attach_workout_evidence(uuid, jsonb) to authenticated;

-- Live workout engine, part 3: phone GPS and step tracking.
-- See docs/architecture.md ("Tracking and evidence") and docs/data-integrity.md.
--
-- The phone uploads what it measured (GPS points, steps per minute). It never uploads a distance:
-- the server computes distance, coverage and step totals itself from those measurements and the
-- session's event log, and stores them in workout_metrics with their source and provenance.
-- Precise location is owner-only, always (hard rule 7).

-- 1. Tables -----------------------------------------------------------------------------------

create table public.workout_route_points (
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  recorded_at timestamptz not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m real check (accuracy_m >= 0),
  altitude_m real check (altitude_m between -500 and 9000),
  speed_ms real check (speed_ms >= 0),
  -- The operating system said this fix came from a mock provider or simulator.
  mocked boolean not null default false,
  received_at timestamptz not null default now(),
  -- One point per instant: re-sending a batch after a lost response adds nothing.
  primary key (session_id, recorded_at)
);

comment on table public.workout_route_points is
  'Phone GPS fixes for a workout. Precise location: visible to the owner only, never to other athletes.';

create table public.workout_motion_samples (
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  -- Steps are stored per clock minute, so samples can never overlap.
  bucket_start timestamptz not null check (bucket_start = date_trunc('minute', bucket_start)),
  seconds smallint not null check (seconds between 1 and 60),
  steps int not null check (steps between 0 and 400),
  received_at timestamptz not null default now(),
  primary key (session_id, bucket_start)
);

comment on table public.workout_motion_samples is
  'Phone pedometer steps per clock minute during a workout. Owner-only.';

create table public.workout_metrics (
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  metric text not null check (metric in
    ('distance_m', 'gps_coverage', 'gps_points', 'gps_mocked_points', 'gps_excluded_m', 'steps', 'motion_coverage')),
  value numeric not null,
  source text not null check (source in ('gps', 'pedometer', 'healthkit', 'health_connect', 'ble_hr', 'manual')),
  provenance text not null check (provenance in ('live', 'synced', 'manual', 'estimated')),
  computed_at timestamptz not null default now(),
  primary key (session_id, metric, source)
);

comment on table public.workout_metrics is
  'Server-computed measurements per workout, each with its source and provenance. Owner-only.';

-- 2. Access: owners read; all writes go through functions ---------------------------------------

alter table public.workout_route_points enable row level security;
alter table public.workout_motion_samples enable row level security;
alter table public.workout_metrics enable row level security;

create policy "workout_route_points: owner can read"
  on public.workout_route_points for select to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

create policy "workout_motion_samples: owner can read"
  on public.workout_motion_samples for select to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

create policy "workout_metrics: owner can read"
  on public.workout_metrics for select to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

revoke all on public.workout_route_points, public.workout_motion_samples, public.workout_metrics from anon, authenticated;
grant select on public.workout_route_points, public.workout_motion_samples, public.workout_metrics to authenticated;

-- 3. Internal helpers --------------------------------------------------------------------------

-- Great-circle distance in metres (haversine, mean Earth radius).
create function public.geo_distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(least(1,
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))));
$$;

-- The stretches of a workout when the timer was running (start/resume → next pause/finish/...).
-- Same rule as workout_active_seconds. A still-running stretch ends at now().
create function public.workout_active_intervals(target uuid)
returns table (from_at timestamptz, to_at timestamptz)
language plpgsql
stable
set search_path = ''
as $$
declare
  e record;
  running_since timestamptz;
begin
  for e in
    select kind, effective_at from public.workout_session_events where session_id = target order by effective_at, id
  loop
    if e.kind in ('start', 'resume') then
      running_since := coalesce(running_since, e.effective_at);
    elsif running_since is not null then
      from_at := running_since;
      to_at := e.effective_at;
      return next;
      running_since := null;
    end if;
  end loop;
  if running_since is not null then
    from_at := running_since;
    to_at := now();
    return next;
  end if;
end;
$$;

-- Recompute a workout's GPS and step metrics from the stored measurements (measurements are never
-- removed, so each metric row is simply replaced with the new value).
--
-- Distance (mirrored on the phone for the live display, apps/mobile/src/features/workout/tracking/track.ts):
--   * only fixes taken while the timer was running, not mocked, with accuracy of 30 m or better;
--   * a fix counts once it is at least 5 m from the last counted fix (ignores jitter while standing still);
--   * a jump faster than the activity allows is left out of the distance and added to gps_excluded_m;
--   * nothing is measured across a pause.
-- Coverage: share of active time in which good fixes arrived no more than 30 s apart.
-- These thresholds are provisional until the device check results are in (docs/device-spike.md).
create function public.refresh_workout_metrics(target uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  s public.workout_sessions;
  froms timestamptz[];
  tos timestamptz[];
  active_s numeric;
  max_speed numeric;
  p record;
  idx int;
  prev_idx int;
  prev_t timestamptz;
  anchor_idx int;
  anchor_t timestamptz;
  anchor_lat double precision;
  anchor_lng double precision;
  d numeric;
  dt numeric;
  dist numeric := 0;
  excluded numeric := 0;
  covered numeric := 0;
  good int := 0;
begin
  select * into s from public.workout_sessions where id = target;
  if s.id is null then
    return;
  end if;

  select array_agg(i.from_at order by i.from_at), array_agg(i.to_at order by i.from_at),
         coalesce(sum(extract(epoch from i.to_at - i.from_at)), 0)
  into froms, tos, active_s
  from public.workout_active_intervals(target) i;
  if froms is null or active_s <= 0 then
    return;
  end if;

  if exists (select 1 from public.workout_route_points where session_id = target) then
    -- Metres per second. A noise and teleport filter, not the scoring plausibility check.
    max_speed := case when s.activity = 'cycle' then 25 else 12.5 end;

    for p in
      select recorded_at, latitude, longitude from public.workout_route_points
      where session_id = target and not mocked and accuracy_m <= 30
      order by recorded_at
    loop
      idx := null;
      for i in 1 .. array_length(froms, 1) loop
        if p.recorded_at >= froms[i] and p.recorded_at <= tos[i] then
          idx := i;
          exit;
        end if;
      end loop;
      continue when idx is null;

      good := good + 1;
      if prev_idx = idx then
        dt := extract(epoch from p.recorded_at - prev_t);
        if dt <= 30 then
          covered := covered + dt;
        end if;
      end if;
      prev_idx := idx;
      prev_t := p.recorded_at;

      if anchor_idx is distinct from idx then
        anchor_idx := idx;
        anchor_t := p.recorded_at;
        anchor_lat := p.latitude;
        anchor_lng := p.longitude;
        continue;
      end if;

      d := public.geo_distance_m(anchor_lat, anchor_lng, p.latitude, p.longitude);
      if d >= 5 then
        dt := extract(epoch from p.recorded_at - anchor_t);
        if dt <= 0 or d / dt > max_speed then
          excluded := excluded + d;
        else
          dist := dist + d;
        end if;
        anchor_t := p.recorded_at;
        anchor_lat := p.latitude;
        anchor_lng := p.longitude;
      end if;
    end loop;

    insert into public.workout_metrics (session_id, metric, value, source, provenance) values
      (target, 'distance_m', round(dist, 1), 'gps', 'live'),
      (target, 'gps_coverage', round(least(1, covered / active_s), 3), 'gps', 'live'),
      (target, 'gps_points', good, 'gps', 'live'),
      (target, 'gps_excluded_m', round(excluded, 1), 'gps', 'live'),
      (target, 'gps_mocked_points',
        (select count(*) from public.workout_route_points where session_id = target and mocked), 'gps', 'live')
    on conflict on constraint workout_metrics_pkey do update set value = excluded.value, computed_at = now();
  end if;

  if exists (select 1 from public.workout_motion_samples where session_id = target) then
    insert into public.workout_metrics (session_id, metric, value, source, provenance)
    select target, x.metric, x.value, 'pedometer', 'live'
    from (
      select coalesce(sum(m.steps), 0) as steps,
             coalesce(sum(m.seconds) filter (where m.steps > 0), 0) as moving_s
      from public.workout_motion_samples m
      where m.session_id = target
        and exists (select 1 from unnest(froms, tos) as i (from_at, to_at)
                    where m.bucket_start < i.to_at and m.bucket_start + interval '1 minute' > i.from_at)
    ) t
    cross join lateral (values
      ('steps', t.steps::numeric),
      ('motion_coverage', round(least(1, t.moving_s / active_s), 3))
    ) as x (metric, value)
    on conflict on constraint workout_metrics_pkey do update set value = excluded.value, computed_at = now();
  end if;
end;
$$;

-- When a workout is finished, compute its metrics from what has arrived so far.
create function public.workout_metrics_on_finish()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.refresh_workout_metrics(new.id);
  return null;
end;
$$;

create trigger workout_metrics_on_finish
  after update of state on public.workout_sessions
  for each row
  when (new.state = 'submitted' and old.state in ('active', 'paused'))
  execute function public.workout_metrics_on_finish();

-- Shared checks for uploads: the caller owns the workout and it still accepts measurements.
-- Measurements recorded on the phone may arrive late (no signal), up to 24 hours after the finish
-- (the late-evidence window in scoring rule v1).
create function public.workout_for_tracking(target uuid)
returns public.workout_sessions
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  s public.workout_sessions;
begin
  select * into s from public.workout_sessions w where w.id = target and w.user_id = uid for update;
  if s.id is null then
    raise exception 'workout_not_found' using errcode = 'P0001';
  end if;
  if s.state in ('abandoned', 'expired') or s.ended_at < now() - interval '24 hours' then
    raise exception 'tracking_window_closed' using errcode = 'P0001';
  end if;
  return s;
end;
$$;

-- 4. Uploads ----------------------------------------------------------------------------------
-- Errors (SQLSTATE P0001): workout_not_found, tracking_window_closed, location_not_used,
-- invalid_points, too_many_points, invalid_samples.

-- points: [{ "t": timestamp, "lat": .., "lng": .., "acc": metres?, "alt": metres?, "spd": m/s?, "mock": bool? }]
-- Returns how many new points were stored. Points outside the workout's time span are ignored.
create function public.add_route_points(session_id uuid, points jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.workout_sessions := public.workout_for_tracking(session_id);
  stored int;
begin
  -- Location is collected only for activities that use it.
  if s.activity not in ('run', 'walk', 'hike', 'cycle') then
    raise exception 'location_not_used' using errcode = 'P0001';
  end if;
  if points is null or jsonb_typeof(points) <> 'array' or jsonb_array_length(points) not between 1 and 500 then
    raise exception 'invalid_points' using errcode = 'P0001';
  end if;
  -- 12 hours at more than one fix per second.
  if (select count(*) from public.workout_route_points r where r.session_id = s.id) + jsonb_array_length(points) > 60000 then
    raise exception 'too_many_points' using errcode = 'P0001';
  end if;

  begin
    insert into public.workout_route_points (session_id, recorded_at, latitude, longitude, accuracy_m, altitude_m, speed_ms, mocked)
    select s.id, r.t, r.lat, r.lng, r.acc, r.alt, r.spd, coalesce(r.mock, false)
    from jsonb_to_recordset(points)
      as r (t timestamptz, lat double precision, lng double precision, acc real, alt real, spd real, mock boolean)
    where r.t >= s.started_at - interval '1 minute'
      and r.t <= coalesce(s.ended_at, now()) + interval '1 minute'
    on conflict do nothing;
    get diagnostics stored = row_count;
  exception
    when check_violation or not_null_violation or data_exception then
      raise exception 'invalid_points' using errcode = 'P0001';
  end;

  if s.state not in ('active', 'paused') then
    perform public.refresh_workout_metrics(s.id);
  end if;
  return stored;
end;
$$;

-- samples: [{ "t": start of the clock minute, "s": seconds measured (1-60), "steps": 0-400 }]
-- Re-sending a minute keeps the larger step count (a minute still in progress grows).
create function public.add_motion_samples(session_id uuid, samples jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.workout_sessions := public.workout_for_tracking(session_id);
  stored int;
begin
  if samples is null or jsonb_typeof(samples) <> 'array' or jsonb_array_length(samples) not between 1 and 750 then
    raise exception 'invalid_samples' using errcode = 'P0001';
  end if;

  begin
    insert into public.workout_motion_samples as m (session_id, bucket_start, seconds, steps)
    select s.id, r.t, r.s, r.steps
    from jsonb_to_recordset(samples) as r (t timestamptz, s smallint, steps int)
    where r.t >= date_trunc('minute', s.started_at)
      and r.t <= coalesce(s.ended_at, now()) + interval '1 minute'
    on conflict on constraint workout_motion_samples_pkey do update
      set steps = greatest(m.steps, excluded.steps), seconds = greatest(m.seconds, excluded.seconds), received_at = now();
    get diagnostics stored = row_count;
  exception
    when check_violation or not_null_violation or data_exception then
      raise exception 'invalid_samples' using errcode = 'P0001';
  end;

  if s.state not in ('active', 'paused') then
    perform public.refresh_workout_metrics(s.id);
  end if;
  return stored;
end;
$$;

-- 5. Who may call what -------------------------------------------------------------------------

revoke all on function
  public.geo_distance_m(double precision, double precision, double precision, double precision),
  public.workout_active_intervals(uuid),
  public.refresh_workout_metrics(uuid),
  public.workout_metrics_on_finish(),
  public.workout_for_tracking(uuid),
  public.add_route_points(uuid, jsonb),
  public.add_motion_samples(uuid, jsonb)
from public, anon, authenticated;

grant execute on function
  public.add_route_points(uuid, jsonb),
  public.add_motion_samples(uuid, jsonb)
to authenticated;

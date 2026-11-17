-- Live workout session engine: a server-side state machine with an append-only event log.
-- See docs/architecture.md ("Live workout session engine").
--
--            pause            finish
--  active ─────────► paused ─────────► submitted ──► (scoring: accepted | needs_review | rejected)
--    ▲  ◄─────────     │
--    │    resume       │ finish            cancel (active/paused) ──► abandoned
--    └─────────────────┘                   12 h after start, still open ──► expired
--
-- The phone never decides times or durations: the server clamps every timestamp and computes active
-- time from the event log. Every call is idempotent (client ids) and version-checked.

-- 1. Tables -----------------------------------------------------------------------------------

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_session_id uuid not null,
  activity text not null check (activity in
    ('run', 'walk', 'hike', 'cycle', 'swim', 'strength', 'hiit', 'yoga', 'indoor_cardio', 'other')),
  state text not null default 'active' check (state in
    ('active', 'paused', 'submitted', 'accepted', 'needs_review', 'rejected', 'abandoned', 'expired')),
  version int not null default 1,
  started_at timestamptz not null,
  ended_at timestamptz,
  active_seconds int check (active_seconds >= 0),
  -- Locked at start: decides the scoring day and season, and which squad the points count for.
  home_timezone text not null,
  local_date date not null,
  squad_id uuid references public.squads (id) on delete set null,
  device_id text check (char_length(device_id) <= 100),
  started_offline boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, client_session_id),
  check (ended_at is null or ended_at >= started_at),
  check ((state in ('active', 'paused')) = (ended_at is null))
);

comment on table public.workout_sessions is
  'Live workout sessions. Times and active_seconds are server-computed. Owner-only.';

-- One open workout per athlete.
create unique index workout_sessions_one_open on public.workout_sessions (user_id)
  where state in ('active', 'paused');
create index workout_sessions_user_date on public.workout_sessions (user_id, local_date desc);

create table public.workout_session_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  client_event_id uuid not null,
  kind text not null check (kind in ('start', 'pause', 'resume', 'finish', 'cancel', 'expire')),
  server_at timestamptz not null default now(),
  client_at timestamptz,
  -- The time used for active-time math: client time clamped to [previous event, now].
  effective_at timestamptz not null,
  offline boolean not null default false,
  device_id text check (char_length(device_id) <= 100),
  unique (session_id, client_event_id)
);

comment on table public.workout_session_events is 'Append-only. Written only by the workout functions.';

create table public.strength_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  client_set_id uuid not null,
  exercise text not null check (char_length(btrim(exercise)) between 1 and 60),
  reps int not null check (reps between 1 and 100),
  weight_kg numeric(5, 1) check (weight_kg >= 0 and weight_kg <= 500),
  server_at timestamptz not null default now(),
  client_at timestamptz,
  effective_at timestamptz not null,
  offline boolean not null default false,
  -- Sets logged after Finish are kept as the athlete's record but are not live evidence.
  after_finish boolean not null default false,
  deleted_at timestamptz,
  unique (session_id, client_set_id)
);

comment on table public.strength_sets is
  'Manually entered sets (labeled manual). Never hard-deleted: deleted_at marks corrections.';

-- 2. Access: owners read; all writes go through functions ---------------------------------------

alter table public.workout_sessions enable row level security;
alter table public.workout_session_events enable row level security;
alter table public.strength_sets enable row level security;

create policy "workout_sessions: owner can read"
  on public.workout_sessions for select to authenticated using (user_id = (select auth.uid()));

create policy "workout_session_events: owner can read"
  on public.workout_session_events for select to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

create policy "strength_sets: owner can read"
  on public.strength_sets for select to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

revoke all on public.workout_sessions, public.workout_session_events, public.strength_sets from anon, authenticated;
grant select on public.workout_sessions, public.workout_session_events, public.strength_sets to authenticated;

-- 3. Internal helpers --------------------------------------------------------------------------

-- Longest an open workout may run before it is closed as expired.
create function public.workout_max_open()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '12 hours' $$;

-- Active seconds from the event log: time between start/resume and the next pause/finish/cancel/expire.
create function public.workout_active_seconds(target uuid, until timestamptz default null)
returns int
language plpgsql
stable
set search_path = ''
as $$
declare
  e record;
  running_since timestamptz;
  total numeric := 0;
begin
  for e in
    select kind, effective_at from public.workout_session_events where session_id = target order by effective_at, id
  loop
    if e.kind in ('start', 'resume') then
      running_since := coalesce(running_since, e.effective_at);
    elsif running_since is not null then
      total := total + extract(epoch from e.effective_at - running_since);
      running_since := null;
    end if;
  end loop;
  if running_since is not null and until is not null then
    total := total + extract(epoch from until - running_since);
  end if;
  return greatest(0, floor(total))::int;
end;
$$;

-- Clamp a client timestamp to [lower, now]; flag it offline if it differs from server time by > 60 s.
create function public.workout_clamp(client_at timestamptz, lower_bound timestamptz, out effective timestamptz, out offline boolean)
language sql
stable
set search_path = ''
as $$
  select
    least(greatest(coalesce(client_at, now()), lower_bound), now()),
    client_at is not null and abs(extract(epoch from now() - client_at)) > 60;
$$;

-- Close open workouts that ran past the maximum. Called lazily by the functions below.
create function public.expire_stale_workouts(target_user uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  s public.workout_sessions;
  cutoff timestamptz;
begin
  for s in
    select * from public.workout_sessions
    where user_id = target_user and state in ('active', 'paused') and started_at < now() - public.workout_max_open()
    for update
  loop
    cutoff := s.started_at + public.workout_max_open();
    insert into public.workout_session_events (session_id, client_event_id, kind, effective_at)
    values (s.id, gen_random_uuid(), 'expire', cutoff);
    update public.workout_sessions
    set state = 'expired', ended_at = cutoff, version = version + 1,
        active_seconds = public.workout_active_seconds(s.id)
    where id = s.id;
  end loop;
end;
$$;

create function public.require_user_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- 4. Actions ----------------------------------------------------------------------------------
-- Errors: stable codes with SQLSTATE P0001 (active_workout_exists, version_conflict, invalid_transition,
-- workout_not_found, timezone_required, invalid_activity, session_not_open, set_window_closed).

create function public.start_workout(
  client_session_id uuid,
  activity text,
  client_started_at timestamptz default null,
  device_id text default null
)
returns public.workout_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  existing public.workout_sessions;
  tz text;
  clamped record;
  result public.workout_sessions;
begin
  perform pg_advisory_xact_lock(hashtextextended('workout:' || uid::text, 0));
  perform public.expire_stale_workouts(uid);

  -- Retried start: same client id returns the same session.
  select * into existing from public.workout_sessions s
  where s.user_id = uid and s.client_session_id = start_workout.client_session_id;
  if existing.id is not null then
    return existing;
  end if;

  if exists (select 1 from public.workout_sessions s where s.user_id = uid and s.state in ('active', 'paused')) then
    raise exception 'active_workout_exists' using errcode = 'P0001';
  end if;

  select home_timezone into tz from public.profile_private where user_id = uid;
  if tz is null then
    raise exception 'timezone_required' using errcode = 'P0001';
  end if;

  -- An offline start may be synced late, but never more than the maximum open time ago.
  select * into clamped from public.workout_clamp(client_started_at, now() - public.workout_max_open());

  insert into public.workout_sessions
    (user_id, client_session_id, activity, started_at, home_timezone, local_date, squad_id, device_id, started_offline)
  values (
    uid, start_workout.client_session_id, start_workout.activity, clamped.effective, tz,
    (clamped.effective at time zone tz)::date,
    (select m.squad_id from public.squad_members m where m.user_id = uid and m.left_at is null),
    left(start_workout.device_id, 100),
    clamped.offline
  )
  returning * into result;

  insert into public.workout_session_events (session_id, client_event_id, kind, client_at, effective_at, offline, device_id)
  values (result.id, start_workout.client_session_id, 'start', client_started_at, clamped.effective, clamped.offline,
          left(start_workout.device_id, 100));

  return result;
exception
  when check_violation then
    if sqlerrm like '%activity%' then
      raise exception 'invalid_activity' using errcode = 'P0001';
    end if;
    raise;
end;
$$;

-- Shared transition logic for pause / resume / finish / cancel.
create function public.workout_transition(
  session_id uuid,
  expected_version int,
  client_event_id uuid,
  kind text,
  client_at timestamptz,
  device_id text
)
returns public.workout_sessions
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  s public.workout_sessions;
  last_at timestamptz;
  clamped record;
  next_state text;
begin
  perform public.expire_stale_workouts(uid);

  select * into s from public.workout_sessions w where w.id = workout_transition.session_id and w.user_id = uid for update;
  if s.id is null then
    raise exception 'workout_not_found' using errcode = 'P0001';
  end if;

  -- Retried request: the event already exists, so just return the current state.
  if exists (select 1 from public.workout_session_events e
             where e.session_id = s.id and e.client_event_id = workout_transition.client_event_id) then
    return s;
  end if;

  next_state := case
    when kind = 'pause' and s.state = 'active' then 'paused'
    when kind = 'resume' and s.state = 'paused' then 'active'
    when kind = 'finish' and s.state in ('active', 'paused') then 'submitted'
    when kind = 'cancel' and s.state in ('active', 'paused') then 'abandoned'
  end;
  if next_state is null then
    raise exception 'invalid_transition' using errcode = 'P0001', detail = format('%s from %s', kind, s.state);
  end if;
  if expected_version <> s.version then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;

  select max(effective_at) into last_at from public.workout_session_events e where e.session_id = s.id;
  select * into clamped from public.workout_clamp(workout_transition.client_at, last_at);

  insert into public.workout_session_events (session_id, client_event_id, kind, client_at, effective_at, offline, device_id)
  values (s.id, workout_transition.client_event_id, kind, workout_transition.client_at, clamped.effective, clamped.offline,
          left(workout_transition.device_id, 100));

  update public.workout_sessions w
  set state = next_state,
      version = w.version + 1,
      ended_at = case when next_state in ('submitted', 'abandoned') then clamped.effective end,
      active_seconds = case when next_state in ('submitted', 'abandoned') then public.workout_active_seconds(s.id) end
  where w.id = s.id
  returning * into s;

  return s;
end;
$$;

create function public.pause_workout(session_id uuid, expected_version int, client_event_id uuid,
                                     client_at timestamptz default null, device_id text default null)
returns public.workout_sessions language sql security definer set search_path = ''
as $$ select public.workout_transition(session_id, expected_version, client_event_id, 'pause', client_at, device_id) $$;

create function public.resume_workout(session_id uuid, expected_version int, client_event_id uuid,
                                      client_at timestamptz default null, device_id text default null)
returns public.workout_sessions language sql security definer set search_path = ''
as $$ select public.workout_transition(session_id, expected_version, client_event_id, 'resume', client_at, device_id) $$;

create function public.finish_workout(session_id uuid, expected_version int, client_event_id uuid,
                                      client_at timestamptz default null, device_id text default null)
returns public.workout_sessions language sql security definer set search_path = ''
as $$ select public.workout_transition(session_id, expected_version, client_event_id, 'finish', client_at, device_id) $$;

create function public.cancel_workout(session_id uuid, expected_version int, client_event_id uuid,
                                      client_at timestamptz default null, device_id text default null)
returns public.workout_sessions language sql security definer set search_path = ''
as $$ select public.workout_transition(session_id, expected_version, client_event_id, 'cancel', client_at, device_id) $$;

-- The athlete's open workout (after closing any that ran too long), for recovery on app launch.
create function public.get_open_workout()
returns setof public.workout_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
begin
  perform public.expire_stale_workouts(uid);
  return query select * from public.workout_sessions where user_id = uid and state in ('active', 'paused');
end;
$$;

-- Strength sets: logged live while the workout is open; up to 1 hour after finishing they are kept
-- but marked after_finish (not live evidence).
create function public.log_strength_set(
  session_id uuid,
  client_set_id uuid,
  exercise text,
  reps int,
  weight_kg numeric default null,
  client_at timestamptz default null
)
returns public.strength_sets
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  s public.workout_sessions;
  existing public.strength_sets;
  clamped record;
  result public.strength_sets;
begin
  select * into s from public.workout_sessions w where w.id = log_strength_set.session_id and w.user_id = uid;
  if s.id is null then
    raise exception 'workout_not_found' using errcode = 'P0001';
  end if;

  select * into existing from public.strength_sets x
  where x.session_id = s.id and x.client_set_id = log_strength_set.client_set_id;
  if existing.id is not null then
    return existing;
  end if;

  if s.state not in ('active', 'paused', 'submitted')
     or (s.state = 'submitted' and s.ended_at < now() - interval '1 hour') then
    raise exception 'set_window_closed' using errcode = 'P0001';
  end if;

  select * into clamped from public.workout_clamp(log_strength_set.client_at, s.started_at);

  insert into public.strength_sets
    (session_id, client_set_id, exercise, reps, weight_kg, client_at, effective_at, offline, after_finish)
  values (s.id, log_strength_set.client_set_id, btrim(log_strength_set.exercise), log_strength_set.reps,
          log_strength_set.weight_kg, log_strength_set.client_at, clamped.effective, clamped.offline,
          s.state = 'submitted')
  returning * into result;
  return result;
end;
$$;

create function public.delete_strength_set(session_id uuid, set_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
begin
  update public.strength_sets x set deleted_at = now()
  from public.workout_sessions s
  where x.id = delete_strength_set.set_id and x.session_id = delete_strength_set.session_id
    and s.id = x.session_id and s.user_id = uid and s.state in ('active', 'paused') and x.deleted_at is null;
  if not found then
    raise exception 'set_window_closed' using errcode = 'P0001';
  end if;
end;
$$;

-- 5. Who may call what -------------------------------------------------------------------------

revoke all on function
  public.workout_max_open(),
  public.workout_active_seconds(uuid, timestamptz),
  public.workout_clamp(timestamptz, timestamptz),
  public.expire_stale_workouts(uuid),
  public.require_user_uid(),
  public.workout_transition(uuid, int, uuid, text, timestamptz, text),
  public.start_workout(uuid, text, timestamptz, text),
  public.pause_workout(uuid, int, uuid, timestamptz, text),
  public.resume_workout(uuid, int, uuid, timestamptz, text),
  public.finish_workout(uuid, int, uuid, timestamptz, text),
  public.cancel_workout(uuid, int, uuid, timestamptz, text),
  public.get_open_workout(),
  public.log_strength_set(uuid, uuid, text, int, numeric, timestamptz),
  public.delete_strength_set(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.start_workout(uuid, text, timestamptz, text),
  public.pause_workout(uuid, int, uuid, timestamptz, text),
  public.resume_workout(uuid, int, uuid, timestamptz, text),
  public.finish_workout(uuid, int, uuid, timestamptz, text),
  public.cancel_workout(uuid, int, uuid, timestamptz, text),
  public.get_open_workout(),
  public.log_strength_set(uuid, uuid, text, int, numeric, timestamptz),
  public.delete_strength_set(uuid, uuid)
to authenticated;

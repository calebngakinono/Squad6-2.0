-- STAGING DEMO DATA. Never run on production.
--
-- Fills the staging database with clearly fake squads, athletes and workouts so the standings,
-- summaries and squad screens have something to show. How to run it: docs/deployment.md
-- ("Staging demo data").
--
-- What it creates (all labelled as demo):
--   * 34 demo athletes: names start with "Demo", emails end in @demo.squadsix.invalid, no password,
--     so nobody can sign in as them.
--   * 7 squads named "Demo · ...", in Saint George, Salt Lake City, Denver (US), Toronto (CA) and
--     London (GB). Sizes 3 to 6; "Demo · Trail Starters" has 3 members, so it earns points but is not
--     ranked (shows the four-member rule).
--   * About 300 workouts from 1 to 16 November 2026 (device id "demo-seed"), with the measurements a
--     phone would record. Points are NOT inserted: the real scoring engine scores these workouts when
--     the script commits, exactly as it scores real ones, so every point traces to a workout and rule v1.
--
-- Safe to run again: everything has fixed ids and existing rows are left alone. It only adds rows.
-- It also switches scoring on for staging from 1 November 2026 (if it was off or started later).

begin;

-- 1. Refuse to run anywhere that is not marked as staging (or a developer's local database) -------
-- Staging is marked once with:  insert into public.deployment_environment (name) values ('staging');
do $$
begin
  if not exists (select 1 from public.deployment_environment where name in ('staging', 'local')) then
    raise exception 'Refusing to load demo data: this database is not marked as staging. On STAGING only, run once: '
      'insert into public.deployment_environment (name) values (''staging''); then run this script again.';
  end if;
end;
$$;

-- 2. Scoring on (staging only) from 1 November 2026 -----------------------------------------------
select public.set_scoring_active('v1', least(
  coalesce((select active_from from public.scoring_rule_versions where version = 'v1'), 'infinity'::timestamptz),
  timestamptz '2026-11-01 00:00:00+00'));

-- 3. Squads and athletes ----------------------------------------------------------------------------
-- A stable pseudo-random number 0-999 from a text seed, so every run produces the same data.
create function pg_temp.h(seed text) returns int language sql immutable as $$
  select abs(('x' || substr(md5(seed), 1, 8))::bit(32)::int) % 1000;
$$;
create function pg_temp.id(seed text) returns uuid language sql immutable as $$
  select md5('squadsix-demo-' || seed)::uuid;
$$;

create temp table demo_squads (n int primary key, name text, city_id bigint, tz text, size int, keenness int) on commit drop;
insert into demo_squads values
  (1, 'Demo · Red Rocks Runners', 5546220, 'America/Denver',  6, 65),
  (2, 'Demo · Dawn Patrol',       5546220, 'America/Denver',  4, 75),
  (3, 'Demo · Trail Starters',    5546220, 'America/Denver',  3, 70),
  (4, 'Demo · Wasatch Wolves',    5780993, 'America/Denver',  5, 55),
  (5, 'Demo · Mile High Six',     5419384, 'America/Denver',  6, 50),
  (6, 'Demo · Lakeshore Movers',  6167865, 'America/Toronto', 6, 60),
  (7, 'Demo · Thames Striders',   2643743, 'Europe/London',   4, 70);

create temp table demo_people on commit drop as
select s.n as squad, p, pg_temp.id('user-' || s.n || '-' || p) as user_id, s.tz, s.city_id, s.keenness,
       'Demo ' || (array['Ana','Ben','Cleo','Dev','Eli','Fay','Gus','Hana','Ivo','Jade','Kai','Lena','Milo','Nia',
                         'Omar','Pia','Quin','Rosa','Sami','Tess','Uma','Vic','Wren','Xavi','Yara','Zane','Abe',
                         'Bea','Cy','Dina','Ezra','Flo','Gio','Hope'])[(s.n - 1) * 6 + p] || ' ' || chr(64 + 1 + pg_temp.h('initial' || s.n || p) % 26) || '.' as display_name
from demo_squads s, generate_series(1, s.size) p;

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'demo-' || squad || '-' || p || '@demo.squadsix.invalid', timestamptz '2026-10-25', timestamptz '2026-10-25'
from demo_people
on conflict (id) do nothing;

-- The signup trigger created the profiles; fill them in.
update public.profiles pr set display_name = d.display_name, city_id = d.city_id
from demo_people d where pr.id = d.user_id and pr.display_name is distinct from d.display_name;
update public.profile_private pp set home_timezone = d.tz, weekly_commitment = 3,
       onboarding_completed_at = coalesce(pp.onboarding_completed_at, timestamptz '2026-10-25')
from demo_people d where pp.user_id = d.user_id and pp.home_timezone is null;

insert into public.squads (id, name, city, city_id, description, created_by, created_at)
select pg_temp.id('squad-' || s.n), s.name, 'demo', s.city_id,
       'Demo squad for testing. These are not real people or real workouts.',
       pg_temp.id('user-' || s.n || '-1'), timestamptz '2026-10-25'
from demo_squads s
on conflict (id) do nothing;

insert into public.squad_members (id, squad_id, user_id, role, joined_at)
select pg_temp.id('member-' || d.squad || '-' || d.p), pg_temp.id('squad-' || d.squad), d.user_id,
       case when d.p = 1 then 'captain' else 'member' end, timestamptz '2026-10-25'
from demo_people d
on conflict (id) do nothing;

insert into public.squad_invite_codes (squad_id, code)
select pg_temp.id('squad-' || n), public.generate_invite_code() from demo_squads
on conflict (squad_id) do nothing;

-- 4. Workouts ---------------------------------------------------------------------------------------
-- At most one per athlete per day, 1-16 November 2026. Plausible paces and durations only.
create temp table demo_workouts on commit drop as
with days as (
  select d.*, day::date as local_date, pg_temp.h('day' || d.user_id || day) as roll
  from demo_people d, generate_series(date '2026-11-01', date '2026-11-16', interval '1 day') day
), picked as (
  select *,
         (array['run', 'walk', 'run', 'cycle', 'strength', 'walk'])[1 + pg_temp.h('activity' || user_id || local_date) % 6] as activity,
         pg_temp.h('minutes' || user_id || local_date) as r1,
         pg_temp.h('pace' || user_id || local_date) as r2
  from days
  where roll < keenness * 10
)
select pg_temp.id('workout-' || user_id || '-' || local_date) as id, user_id, squad, tz, local_date, activity,
       case activity when 'run' then 25 + r1 % 31 when 'walk' then 25 + r1 % 36
                     when 'cycle' then 35 + r1 % 41 else 35 + r1 % 26 end as minutes,
       ((local_date + make_interval(hours => 6 + r2 % 13, mins => r1 % 60)) at time zone tz) as started_at,
       r2
from picked;

insert into public.workout_sessions
  (id, user_id, client_session_id, activity, state, version, started_at, ended_at, active_seconds,
   home_timezone, local_date, squad_id, device_id, created_at)
select w.id, w.user_id, w.id, w.activity, 'submitted', 2, w.started_at, w.started_at + make_interval(mins => w.minutes),
       w.minutes * 60, w.tz, w.local_date, pg_temp.id('squad-' || w.squad), 'demo-seed', w.started_at
from demo_workouts w
on conflict (id) do nothing;

insert into public.workout_session_events (session_id, client_event_id, kind, server_at, client_at, effective_at, device_id)
select w.id, pg_temp.id('event-' || w.id || '-' || e.kind), e.kind, e.at, e.at, e.at, 'demo-seed'
from demo_workouts w,
     lateral (values ('start', w.started_at), ('finish', w.started_at + make_interval(mins => w.minutes))) e (kind, at)
on conflict (session_id, client_event_id) do nothing;

-- Strength: sets logged live, evenly spread through the workout.
insert into public.strength_sets (session_id, client_set_id, exercise, reps, weight_kg, server_at, client_at, effective_at)
select w.id, pg_temp.id('set-' || w.id || '-' || i),
       (array['Squat', 'Bench press', 'Deadlift', 'Row', 'Overhead press', 'Lunge'])[1 + i % 6], 6 + (w.r2 + i) % 7, null, t, t, t
from demo_workouts w,
     generate_series(0, 7 + w.r2 % 11) i,
     lateral (select w.started_at + make_interval(secs => 60 + i * ((w.minutes * 60 - 120.0) / (7 + w.r2 % 11)))) s (t)
where w.activity = 'strength'
on conflict (session_id, client_set_id) do nothing;

-- Measurements a phone would have recorded. Distance from a plausible pace for each activity.
insert into public.workout_metrics (session_id, metric, value, source, provenance)
select w.id, m.metric, m.value, m.source, 'live'
from demo_workouts w,
     lateral (select case w.activity
                       when 'run' then w.minutes / (5.0 + (w.r2 % 26) / 10.0)              -- 5:00 to 7:30 per km
                       when 'walk' then w.minutes / 60.0 * (4.8 + (w.r2 % 16) / 10.0)      -- 4.8 to 6.3 km/h
                       when 'cycle' then w.minutes / 60.0 * (17 + w.r2 % 12)               -- 17 to 28 km/h
                     end as km) d,
     lateral (values
       ('distance_m', round(d.km * 1000, 1), 'gps'),
       ('gps_coverage', 0.85 + (w.r2 % 14) / 100.0, 'gps'),
       ('gps_points', w.minutes * 55, 'gps'),
       ('gps_excluded_m', 0, 'gps'),
       ('gps_mocked_points', 0, 'gps'),
       ('steps', round(w.minutes * case w.activity when 'run' then 160 else 110 end), 'pedometer'),
       ('motion_coverage', 0.8 + (w.r2 % 16) / 100.0, 'pedometer')
     ) m (metric, value, source)
where w.activity in ('run', 'walk', 'cycle')
  and not (w.activity = 'cycle' and m.source = 'pedometer') -- the app does not count steps on rides
on conflict on constraint workout_metrics_pkey do nothing;

-- 5. Score every demo day with the real scoring engine (the same function that scores real workouts).
-- Running it again changes nothing: a workout is awarded once.
select count(public.score_day(user_id, local_date)) as days_scored
from (select distinct user_id, local_date from demo_workouts) x;

commit;

-- What was loaded:
select s.name, s.city, count(distinct m.user_id) as members,
       (select count(*) from public.workout_sessions w where w.squad_id = s.id) as workouts,
       coalesce((select sum(points) from public.points_ledger l where l.squad_id = s.id), 0) as points
from public.squads s join public.squad_members m on m.squad_id = s.id and m.left_at is null
where s.name like 'Demo · %'
group by s.id order by points desc;

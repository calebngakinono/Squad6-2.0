begin;
select plan(39);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');
update public.profile_private set home_timezone = 'America/Denver';

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;
create function pg_temp.get(key text) returns text language sql as $$ select v from ctx where k = key $$;
create function pg_temp.act_as(c text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || c)::text, true);
$$;
-- n+1 fixes one second apart heading north from lat0, `step` degrees per second (0.00003 deg = 3.34 m).
create function pg_temp.track(start timestamptz, n int, lat0 float8, step float8, mock boolean default false, acc real default 5)
returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('t', start + i * interval '1 second', 'lat', lat0 + i * step, 'lng', -111.0,
                                      'acc', acc, 'spd', 3.3, 'mock', mock))
  from generate_series(0, n) i;
$$;
create function pg_temp.metric(session text, name text) returns numeric language sql as $$
  select value from public.workout_metrics where session_id = session::uuid and metric = name;
$$;
grant execute on function pg_temp.get(text), pg_temp.act_as(text), pg_temp.track(timestamptz, int, float8, float8, boolean, real),
  pg_temp.metric(text, text) to authenticated, anon;

set local role authenticated;
select pg_temp.act_as('a');
insert into ctx select 'w', (public.start_workout(gen_random_uuid(), 'run', now() - interval '30 minutes')).id;

-- Uploading GPS points ---------------------------------------------------------------------------
select throws_ok(format($$insert into public.workout_route_points (session_id, recorded_at, latitude, longitude)
  values (%L, now(), 40, -111)$$, pg_temp.get('w')), '42501', null, 'clients cannot write route points directly');

-- A 60-second jog: 61 fixes, 3.34 m apart = 200.15 m.
select is(public.add_route_points(pg_temp.get('w')::uuid, pg_temp.track(now() - interval '29 minutes', 60, 40.0, 0.00003)), 61,
  'a batch of points is stored');
select is(public.add_route_points(pg_temp.get('w')::uuid, pg_temp.track(now() - interval '29 minutes', 60, 40.0, 0.00003)), 0,
  're-sending the same batch stores nothing new');
select is(public.add_route_points(pg_temp.get('w')::uuid, pg_temp.track(now() - interval '2 hours', 5, 40.0, 0.00003)), 0,
  'points from before the workout are ignored');
select is((select count(*)::int from public.workout_metrics), 0, 'no official metrics while the workout is still open');

select throws_ok(format($$select public.add_route_points(%L, jsonb_build_array(jsonb_build_object('t', now() - interval '1 minute', 'lat', 95, 'lng', 0)))$$, pg_temp.get('w')),
  'P0001', 'invalid_points', 'an impossible latitude is refused');
select throws_ok(format($$select public.add_route_points(%L, '[{"t":"not a time","lat":40,"lng":0}]')$$, pg_temp.get('w')),
  'P0001', 'invalid_points', 'a malformed time is refused');
select throws_ok(format($$select public.add_route_points(%L, '{"lat":40}')$$, pg_temp.get('w')),
  'P0001', 'invalid_points', 'the payload must be a list');
select throws_ok(format($$select public.add_route_points(%L, pg_temp.track(now() - interval '10 minutes', 500, 40.0, 0.00001))$$,
  pg_temp.get('w')), 'P0001', 'invalid_points', 'at most 500 points per call');

-- Pause from -25 to -20 minutes. Movement during the pause must not count.
select is((public.pause_workout(pg_temp.get('w')::uuid, 1, gen_random_uuid(), now() - interval '25 minutes')).state, 'paused', 'paused');
select is((public.resume_workout(pg_temp.get('w')::uuid, 2, gen_random_uuid(), now() - interval '20 minutes')).state, 'active', 'resumed');
select is(public.add_route_points(pg_temp.get('w')::uuid, pg_temp.track(now() - interval '24 minutes', 60, 40.01, 0.00003)), 61,
  'points recorded during a pause are stored');
-- Mocked fixes and inaccurate fixes after the resume must not count either.
select is(public.add_route_points(pg_temp.get('w')::uuid, pg_temp.track(now() - interval '19 minutes', 9, 40.02, 0.00003, true)), 10,
  'mocked points are stored (and flagged)');
select is(public.add_route_points(pg_temp.get('w')::uuid, pg_temp.track(now() - interval '17 minutes', 9, 40.03, 0.00003, false, 80)), 10,
  'inaccurate points are stored');
-- A jump of 11 km in one second, then 6.67 m of real movement.
select is(public.add_route_points(pg_temp.get('w')::uuid, jsonb_build_array(
  jsonb_build_object('t', now() - interval '15 minutes', 'lat', 40.1, 'lng', -111.0, 'acc', 5),
  jsonb_build_object('t', now() - interval '15 minutes' + interval '1 second', 'lat', 40.2, 'lng', -111.0, 'acc', 5),
  jsonb_build_object('t', now() - interval '15 minutes' + interval '2 seconds', 'lat', 40.20003, 'lng', -111.0, 'acc', 5),
  jsonb_build_object('t', now() - interval '15 minutes' + interval '3 seconds', 'lat', 40.20006, 'lng', -111.0, 'acc', 5))), 4,
  'points with a GPS jump are stored');

-- Uploading steps --------------------------------------------------------------------------------
select throws_ok(format($$insert into public.workout_motion_samples (session_id, bucket_start, seconds, steps)
  values (%L, date_trunc('minute', now()), 60, 100)$$, pg_temp.get('w')), '42501', null, 'clients cannot write step samples directly');
select is(public.add_motion_samples(pg_temp.get('w')::uuid, jsonb_build_array(
  jsonb_build_object('t', date_trunc('minute', now() - interval '28 minutes'), 's', 60, 'steps', 150),
  jsonb_build_object('t', date_trunc('minute', now() - interval '23 minutes'), 's', 60, 'steps', 100),
  jsonb_build_object('t', date_trunc('minute', now() - interval '10 minutes'), 's', 60, 'steps', 160))), 3,
  'step samples are stored');
select lives_ok(format($$select public.add_motion_samples(%L, jsonb_build_array(
  jsonb_build_object('t', date_trunc('minute', now() - interval '28 minutes'), 's', 60, 'steps', 90)))$$, pg_temp.get('w')),
  'a minute can be sent again');
select is((select steps from public.workout_motion_samples where bucket_start = date_trunc('minute', now() - interval '28 minutes')), 150,
  're-sending a minute never lowers its steps');
select throws_ok(format($$select public.add_motion_samples(%L, jsonb_build_array(
  jsonb_build_object('t', date_trunc('minute', now()) - interval '5 minutes 7 seconds', 's', 60, 'steps', 100)))$$, pg_temp.get('w')),
  'P0001', 'invalid_samples', 'samples must start on a clock minute');
select throws_ok(format($$select public.add_motion_samples(%L, jsonb_build_array(
  jsonb_build_object('t', date_trunc('minute', now() - interval '5 minutes'), 's', 60, 'steps', 900)))$$, pg_temp.get('w')),
  'P0001', 'invalid_samples', 'impossible step counts are refused');

-- Finish: the server computes the official metrics -------------------------------------------------
-- Active time = (-30 → -25) + (-20 → now) = 300 + 1200 = 1500 s.
select is((public.finish_workout(pg_temp.get('w')::uuid, 3, gen_random_uuid())).state, 'submitted', 'finished');
select ok(pg_temp.metric(pg_temp.get('w'), 'distance_m') between 206.5 and 207.1,
  'distance = the 200.15 m jog + 6.67 m; pause, mocked, inaccurate and jump are left out');
select ok(pg_temp.metric(pg_temp.get('w'), 'gps_excluded_m') between 11000 and 11200, 'the jump is recorded as excluded distance');
select is(pg_temp.metric(pg_temp.get('w'), 'gps_points'), 65::numeric, 'good points while the timer ran: 61 + 4');
select is(pg_temp.metric(pg_temp.get('w'), 'gps_mocked_points'), 10::numeric, 'mocked points are counted');
select is(pg_temp.metric(pg_temp.get('w'), 'gps_coverage'), 0.042, 'coverage = 63 s of fixes / 1500 s active');
select is(pg_temp.metric(pg_temp.get('w'), 'steps'), 310::numeric, 'steps during the pause are not counted');
select is(pg_temp.metric(pg_temp.get('w'), 'motion_coverage'), 0.08, 'motion coverage = 120 s with steps / 1500 s active');
select is((select string_agg(distinct source || '/' || provenance, ',' order by source || '/' || provenance) from public.workout_metrics),
  'gps/live,pedometer/live', 'every metric records its source and provenance');
select throws_ok($$update public.workout_metrics set value = 99999$$, '42501', null, 'clients cannot edit metrics');

-- Points that arrive after the finish (the phone was offline) update the metrics.
select is(public.add_route_points(pg_temp.get('w')::uuid, pg_temp.track(now() - interval '5 minutes', 2, 40.20009, 0.00003)), 3,
  'late points are accepted within the window');
select is(pg_temp.metric(pg_temp.get('w'), 'gps_points'), 68::numeric, 'and the metrics are recomputed');

-- Another athlete --------------------------------------------------------------------------------
select pg_temp.act_as('b');
select is((select count(*)::int from public.workout_route_points) + (select count(*)::int from public.workout_motion_samples)
  + (select count(*)::int from public.workout_metrics), 0, 'others cannot see the route, steps or metrics');
select throws_ok(format($$select public.add_route_points(%L, pg_temp.track(now() - interval '5 minutes', 2, 40.0, 0.00003))$$,
  pg_temp.get('w')), 'P0001', 'workout_not_found', 'others cannot add points to the workout');

-- Location is only collected for activities that use it; cancelled workouts take nothing.
insert into ctx select 'wb', (public.start_workout(gen_random_uuid(), 'strength')).id;
select throws_ok(format($$select public.add_route_points(%L, pg_temp.track(now(), 2, 40.0, 0.00003))$$, pg_temp.get('wb')),
  'P0001', 'location_not_used', 'a strength workout does not accept location');
select is((public.cancel_workout(pg_temp.get('wb')::uuid, 1, gen_random_uuid())).state, 'abandoned', 'cancelled');
select throws_ok(format($$select public.add_motion_samples(%L, jsonb_build_array(
  jsonb_build_object('t', date_trunc('minute', now()), 's', 30, 'steps', 10)))$$, pg_temp.get('wb')),
  'P0001', 'tracking_window_closed', 'a cancelled workout accepts no measurements');

set local role anon;
select throws_ok($$select public.add_route_points(gen_random_uuid(), '[]')$$, '42501', null,
  'anonymous visitors cannot upload points');

select * from finish();
rollback;

begin;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');
update public.profile_private set home_timezone = 'UTC';
select public.set_scoring_active('v1', '2026-01-01');

-- A finished 30-minute run for A with phone GPS and steps, and one still open.
insert into public.workout_sessions (id, user_id, client_session_id, activity, state, started_at, ended_at, active_seconds, home_timezone, local_date) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', gen_random_uuid(), 'run', 'submitted',
   '2026-06-01 07:00+00', '2026-06-01 07:30+00', 1800, 'UTC', '2026-06-01'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', gen_random_uuid(), 'run', 'active',
   '2026-06-02 07:00+00', null, 0, 'UTC', '2026-06-02');
insert into public.workout_metrics (session_id, metric, value, source, provenance) values
  ('10000000-0000-0000-0000-000000000001', 'distance_m', 5000, 'gps', 'live'),
  ('10000000-0000-0000-0000-000000000001', 'gps_coverage', 0.95, 'gps', 'live'),
  ('10000000-0000-0000-0000-000000000001', 'gps_points', 1000, 'gps', 'live'),
  ('10000000-0000-0000-0000-000000000001', 'gps_excluded_m', 0, 'gps', 'live'),
  ('10000000-0000-0000-0000-000000000001', 'gps_mocked_points', 0, 'gps', 'live');

-- Before any retry the workout has no score (as if scoring had been missed).
delete from public.workout_scores where session_id = '10000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.workout_scores where session_id = '10000000-0000-0000-0000-000000000001'), 0, 'starts without a score');

set local role anon;
select throws_ok($$select public.rescore_my_workout('10000000-0000-0000-0000-000000000001')$$, '42501', null, 'visitors cannot call it');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);
select throws_ok($$select public.rescore_my_workout('10000000-0000-0000-0000-000000000001')$$, 'P0001', 'workout_not_found', 'nobody can rescore someone else''s workout');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
select throws_ok($$select public.rescore_my_workout('10000000-0000-0000-0000-000000000002')$$, 'P0001', 'workout_not_finished', 'an open workout cannot be scored');
select lives_ok($$select public.rescore_my_workout('10000000-0000-0000-0000-000000000001')$$, 'the owner can ask for a score');
select public.rescore_my_workout('10000000-0000-0000-0000-000000000001');

reset role;
select is((select status from public.workout_scores where session_id = '10000000-0000-0000-0000-000000000001'), 'accepted', 'the retry writes the score');
select is(
  (select coalesce(sum(points), 0)::int from public.points_ledger where source_id = '10000000-0000-0000-0000-000000000001'),
  (select total from public.workout_scores where session_id = '10000000-0000-0000-0000-000000000001'),
  'retrying twice awards the points once');
select ok((select total from public.workout_scores where session_id = '10000000-0000-0000-0000-000000000001') > 0, 'and they are real points');

select * from finish();
rollback;

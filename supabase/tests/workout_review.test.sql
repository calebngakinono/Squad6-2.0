begin;
select plan(21);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');
update public.profile_private set home_timezone = 'UTC';
update public.profiles set display_name = 'Athlete';
select public.set_scoring_active('v1', '2026-01-01');

create temp table w (k text primary key, id uuid);
create function pg_temp.workout(k text, activity text, minutes numeric, start_min int, km numeric) returns void language plpgsql as $$
declare
  id uuid := gen_random_uuid();
  t0 timestamptz := timestamptz '2026-06-01 00:00:00+00' + make_interval(mins => start_min);
begin
  insert into public.workout_sessions (id, user_id, client_session_id, activity, state, started_at, ended_at, active_seconds, home_timezone, local_date)
  values (id, '00000000-0000-0000-0000-00000000000a', gen_random_uuid(), activity, 'submitted', t0, t0 + make_interval(mins => minutes::int), minutes * 60, 'UTC', '2026-06-01');
  insert into public.workout_metrics (session_id, metric, value, source, provenance) values
    (id, 'distance_m', km * 1000, 'gps', 'live'), (id, 'gps_coverage', 0.95, 'gps', 'live'),
    (id, 'gps_excluded_m', 0, 'gps', 'live'), (id, 'gps_mocked_points', 0, 'gps', 'live'),
    (id, 'steps', 4000, 'pedometer', 'live'), (id, 'motion_coverage', 0.9, 'pedometer', 'live');
  insert into w values (k, id);
end;
$$;
create function pg_temp.result(key text) returns text language sql as $$
  select status || ' ' || total from public.workout_scores where session_id = (select id from w where k = key);
$$;
create function pg_temp.ledger() returns text language sql as $$
  select coalesce(string_agg(kind || ':' || points, ',' order by id), '') from public.points_ledger;
$$;

-- A ride at 70 km/h (flagged) in the morning, an honest run in the evening.
select pg_temp.workout('ride', 'cycle', 60, 420, 70);
select pg_temp.workout('run', 'run', 30, 1080, 5);
select public.score_day('00000000-0000-0000-0000-00000000000a', '2026-06-01');

select is(pg_temp.result('ride'), 'needs_review 0', 'a flagged workout earns nothing');
select ok((select detail ->> 'reason' from public.workout_scores where session_id = (select id from w where k = 'ride'))
  like '%until a person at Squad Six has reviewed it.', 'and the athlete is told a person will look at it');
select is(pg_temp.result('run'), 'accepted 214', 'the flagged workout does not use up the first slot of the day');
select is((select count(*)::int from public.workouts_awaiting_review), 1, 'the review list shows the flagged workout');
select is((select athlete || '/' || activity || '/' || gps_km from public.workouts_awaiting_review), 'Athlete/cycle/70.00',
  'with the athlete, activity and distance (no coordinates)');

-- It stays at 0 however long nobody looks.
update public.workout_scores set scored_at = now() - interval '60 days';
select public.score_day('00000000-0000-0000-0000-00000000000a', '2026-06-01');
select is(pg_temp.result('ride'), 'needs_review 0', 'a flagged workout is never accepted automatically');

-- Accept: scored like any other workout. It is the first of the day, so the run drops to 50 %.
select is((public.review_workout((select id from w where k = 'ride'), 'accepted', 'Downhill race, checked with the athlete', 'Caleb')).status,
  'accepted', 'a reviewer can accept it');
select is(pg_temp.result('ride'), 'accepted 245', 'ride: 170 + 25 + 50 (60 minutes, top speed bracket)');
select is(pg_temp.result('run'), 'accepted 107', 'the run becomes the second workout of the day');
select is(pg_temp.ledger(), 'award:214,award:245,adjustment:-107', 'the ledger records the award and the knock-on adjustment');
select ok((select detail -> 'notes' from public.workout_scores where session_id = (select id from w where k = 'ride')) ? 'Reviewed and accepted by Squad Six.',
  'the athlete sees that it was reviewed');
select is((select count(*)::int from public.workouts_awaiting_review), 0, 'the review list is empty again');

-- Reverse the ruling: the latest decision wins and the points follow.
select is((public.review_workout((select id from w where k = 'ride'), 'rejected', 'This was recorded in a car', 'Caleb')).status,
  'rejected', 'a ruling can be reversed');
select is(pg_temp.result('ride') || ' / ' || pg_temp.result('run'), 'rejected 0 / accepted 214', 'points return to what they were');
select is(pg_temp.ledger(), 'award:214,award:245,adjustment:-107,adjustment:-245,adjustment:107', 'every change is a new row; nothing is edited');
select is((select detail ->> 'reason' from public.workout_scores where session_id = (select id from w where k = 'ride')),
  'Reviewed by Squad Six and not counted: This was recorded in a car', 'the athlete sees the reason');

-- A reviewer can also reject a workout the checks accepted.
select is((public.review_workout((select id from w where k = 'run'), 'rejected', 'Reported by the squad as not theirs', 'Caleb')).total, 0,
  'an accepted workout can be rejected');
select throws_ok($$select public.review_workout(gen_random_uuid(), 'accepted', 'no such workout', 'Caleb')$$, 'P0001', 'workout_not_scored',
  'only scored workouts can be reviewed');

-- Athletes: can see decisions on their own workouts, cannot review or see the list.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
select is((select count(*)::int from public.workout_reviews), 3, 'athletes can see the decisions on their own workouts');
select throws_ok($$select public.review_workout(gen_random_uuid(), 'accepted', 'mine is fine', 'me')$$, '42501', null,
  'athletes cannot review workouts');
select throws_ok($$select * from public.workouts_awaiting_review$$, '42501', null, 'athletes cannot see the review list');

select * from finish();
rollback;

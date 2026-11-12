begin;
select plan(38);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.com');
update public.profile_private set home_timezone = 'America/Denver'
  where user_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;
create function pg_temp.get(key text) returns text language sql as $$ select v from ctx where k = key $$;
create function pg_temp.act_as(c text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || c)::text, true);
$$;
grant execute on function pg_temp.get(text), pg_temp.act_as(text) to authenticated, anon;

set local role authenticated;

-- User A is in a squad, so the workout records it.
select pg_temp.act_as('a');
insert into ctx values ('squad', public.create_squad('Testers', 'Denver'));

-- Start -------------------------------------------------------------------------------------------
select pg_temp.act_as('c');
select throws_ok($$select public.start_workout(gen_random_uuid(), 'run')$$, 'P0001', 'timezone_required',
  'a workout needs a home time zone');

select pg_temp.act_as('a');
insert into ctx values ('cid', '11111111-1111-1111-1111-111111111111');
insert into ctx select 'w', (public.start_workout(pg_temp.get('cid')::uuid, 'strength', now() - interval '30 minutes', 'iphone')).id;
select is((select state || '/' || version from public.workout_sessions where id = pg_temp.get('w')::uuid), 'active/1', 'starts active at version 1');
select is((select squad_id::text from public.workout_sessions where id = pg_temp.get('w')::uuid), pg_temp.get('squad'),
  'records the squad at start');
select is((select local_date from public.workout_sessions where id = pg_temp.get('w')::uuid),
  ((now() - interval '30 minutes') at time zone 'America/Denver')::date, 'scoring day uses the home time zone');
select is((public.start_workout(pg_temp.get('cid')::uuid, 'strength')).id::text, pg_temp.get('w'),
  'a retried start returns the same workout');
select throws_ok($$select public.start_workout(gen_random_uuid(), 'run')$$, 'P0001', 'active_workout_exists',
  'only one open workout at a time');
select is((select id::text from public.get_open_workout()), pg_temp.get('w'), 'get_open_workout finds it for recovery');

-- Direct writes are refused.
select throws_ok($$update public.workout_sessions set active_seconds = 99999$$, '42501', null, 'clients cannot edit workouts');
select throws_ok($$insert into public.workout_session_events (session_id, client_event_id, kind, effective_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'start', now())$$, '42501', null, 'clients cannot write events');

-- Transitions ------------------------------------------------------------------------------------
select throws_ok(format($$select public.pause_workout(%L, 7, gen_random_uuid())$$, pg_temp.get('w')), 'P0001', 'version_conflict',
  'a stale version is refused');
insert into ctx values ('e1', '22222222-2222-2222-2222-222222222222');
select is((public.pause_workout(pg_temp.get('w')::uuid, 1, pg_temp.get('e1')::uuid, now() - interval '20 minutes')).state, 'paused',
  'pause works');
select is((public.pause_workout(pg_temp.get('w')::uuid, 1, pg_temp.get('e1')::uuid, now() - interval '20 minutes')).version, 2,
  'a retried pause changes nothing');
select is((select count(*)::int from public.workout_session_events where session_id = pg_temp.get('w')::uuid), 2,
  'the retry did not add an event');
select throws_ok(format($$select public.pause_workout(%L, 2, gen_random_uuid())$$, pg_temp.get('w')), 'P0001', 'invalid_transition',
  'cannot pause a paused workout');

-- Resume with a client time BEFORE the pause: clamped to the pause time.
select is((public.resume_workout(pg_temp.get('w')::uuid, 2, gen_random_uuid(), now() - interval '25 minutes')).state, 'active', 'resume works');
select is(
  (select effective_at from public.workout_session_events where session_id = pg_temp.get('w')::uuid and kind = 'resume'),
  now() - interval '20 minutes', 'an event cannot be earlier than the previous one');
select is((select offline from public.workout_session_events where session_id = pg_temp.get('w')::uuid and kind = 'resume'), true,
  'a client time far from server time is flagged offline');

-- Strength sets ----------------------------------------------------------------------------------
insert into ctx values ('set1', '33333333-3333-3333-3333-333333333333');
select is((public.log_strength_set(pg_temp.get('w')::uuid, pg_temp.get('set1')::uuid, ' Squat ', 5, 100, now() - interval '5 minutes')).exercise,
  'Squat', 'a set is logged (trimmed)');
select is((public.log_strength_set(pg_temp.get('w')::uuid, pg_temp.get('set1')::uuid, 'Squat', 5, 100)).id,
  (select id from public.strength_sets where client_set_id = pg_temp.get('set1')::uuid), 'a retried set is not duplicated');
select throws_ok(format($$select public.log_strength_set(%L, gen_random_uuid(), 'Squat', 500)$$, pg_temp.get('w')), '23514', null,
  'impossible reps are refused');
insert into ctx select 'set2', (public.log_strength_set(pg_temp.get('w')::uuid, gen_random_uuid(), 'Bench', 8)).id;
select lives_ok(format($$select public.delete_strength_set(%L, %L)$$, pg_temp.get('w'), pg_temp.get('set2')), 'a set can be removed while open');
select is((select deleted_at is not null from public.strength_sets where id = pg_temp.get('set2')::uuid), true,
  'removal is a soft delete');

-- Finish: active = (start -30 → pause -20) + (resume clamped to -20 → finish now) = 10 + 20 = 30 minutes.
select is((public.finish_workout(pg_temp.get('w')::uuid, 3, gen_random_uuid(), now() + interval '1 hour')).state, 'submitted',
  'finish submits the workout');
select is((select active_seconds from public.workout_sessions where id = pg_temp.get('w')::uuid), 1800,
  'active time is computed by the server from the event log');
select is((select ended_at from public.workout_sessions where id = pg_temp.get('w')::uuid), now(),
  'a future client time is clamped to now');
select throws_ok(format($$select public.resume_workout(%L, 4, gen_random_uuid())$$, pg_temp.get('w')), 'P0001', 'invalid_transition',
  'a finished workout cannot be resumed');
select is((public.log_strength_set(pg_temp.get('w')::uuid, gen_random_uuid(), 'Row', 10)).after_finish, true,
  'a set logged after finishing is kept but marked');
select throws_ok(format($$select public.delete_strength_set(%L, %L)$$, pg_temp.get('w'),
  (select id from public.strength_sets where client_set_id = pg_temp.get('set1')::uuid)), 'P0001', 'set_window_closed',
  'sets cannot be removed after finishing');

-- Another athlete --------------------------------------------------------------------------------
select pg_temp.act_as('b');
select is((select count(*)::int from public.workout_sessions), 0, 'others cannot see the workout');
select is((select count(*)::int from public.strength_sets), 0, 'others cannot see the sets');
select throws_ok(format($$select public.cancel_workout(%L, 4, gen_random_uuid())$$, pg_temp.get('w')), 'P0001', 'workout_not_found',
  'others cannot change the workout');
select throws_ok($$select public.start_workout(gen_random_uuid(), 'skydiving')$$, 'P0001', 'invalid_activity', 'unknown activities are refused');

-- Offline start far in the past is clamped to the 12-hour maximum.
insert into ctx select 'wb', (public.start_workout(gen_random_uuid(), 'walk', now() - interval '20 hours')).id;
select is((select started_at from public.workout_sessions where id = pg_temp.get('wb')::uuid), now() - interval '12 hours',
  'an old offline start is clamped');
select is((select started_offline from public.workout_sessions where id = pg_temp.get('wb')::uuid), true, 'and flagged offline');

-- Expiry: a workout open longer than 12 hours is closed when the athlete next uses the app.
reset role;
update public.workout_sessions set started_at = now() - interval '13 hours' where id = pg_temp.get('wb')::uuid;
update public.workout_session_events set effective_at = now() - interval '13 hours' where session_id = pg_temp.get('wb')::uuid;
set local role authenticated;
select pg_temp.act_as('b');
select is((select count(*)::int from public.get_open_workout()), 0, 'expired workouts are no longer open');
select is((select state || '/' || active_seconds from public.workout_sessions where id = pg_temp.get('wb')::uuid), 'expired/43200',
  'expired at the 12-hour limit');

-- Cancel
insert into ctx select 'wc', (public.start_workout(gen_random_uuid(), 'yoga')).id;
select is((public.cancel_workout(pg_temp.get('wc')::uuid, 1, gen_random_uuid())).state, 'abandoned', 'cancel abandons the workout');

set local role anon;
select throws_ok($$select public.start_workout(gen_random_uuid(), 'run')$$, '42501', null, 'anonymous visitors cannot start workouts');

select * from finish();
rollback;

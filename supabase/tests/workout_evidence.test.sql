begin;
select plan(24);

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
-- A watch workout from 28 to 2 minutes ago, with changes merged in.
create function pg_temp.ev(changes jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('provider', 'healthkit', 'id', 'HK-1', 'source_name', 'Apple Watch', 'bundle_id', 'com.apple.health',
    'device_name', 'Apple Watch', 'activity', 'running', 'start', now() - interval '28 minutes', 'end', now() - interval '2 minutes',
    'user_entered', false, 'distance_m', 5010.4, 'energy_kcal', 410, 'hr_samples', 300, 'hr_minutes', 24,
    'hr_min', 92, 'hr_avg', 151.3, 'hr_max', 178) || changes;
$$;
create function pg_temp.metric(session text, name text, src text) returns numeric language sql as $$
  select value from public.workout_metrics where session_id = session::uuid and metric = name and source = src;
$$;
grant execute on function pg_temp.get(text), pg_temp.act_as(text), pg_temp.ev(jsonb), pg_temp.metric(text, text, text) to authenticated, anon;

set local role authenticated;
select pg_temp.act_as('a');
insert into ctx select 'w', (public.start_workout(gen_random_uuid(), 'run', now() - interval '30 minutes')).id;

select throws_ok(format($$select public.attach_workout_evidence(%L, pg_temp.ev())$$, pg_temp.get('w')),
  'P0001', 'workout_not_finished', 'evidence is attached after the finish, not during the workout');
select is((public.finish_workout(pg_temp.get('w')::uuid, 1, gen_random_uuid())).state, 'submitted', 'finished');

select throws_ok(format($$insert into public.workout_evidence (session_id, provider, external_record_id, source_bundle_id, started_at, ended_at, overlap)
  values (%L, 'healthkit', 'X', 'com.apple.health', now() - interval '1 hour', now(), 1)$$, pg_temp.get('w')),
  '42501', null, 'clients cannot write evidence directly');
select throws_ok(format($$select public.attach_workout_evidence(%L, pg_temp.ev('{"user_entered": true}'))$$, pg_temp.get('w')),
  'P0001', 'manual_record', 'a workout typed into Apple Health by hand is refused');
select throws_ok(format($$select public.attach_workout_evidence(%L, pg_temp.ev('{"bundle_id": "com.squadsix.app"}'))$$, pg_temp.get('w')),
  'P0001', 'own_record', 'a record written by Squad Six itself is refused');
select throws_ok(format($$select public.attach_workout_evidence(%L, pg_temp.ev(jsonb_build_object('start', now() - interval '3 hours', 'end', now() - interval '2 hours')))$$,
  pg_temp.get('w')), 'P0001', 'no_overlap', 'a record from another time is refused');
select throws_ok(format($$select public.attach_workout_evidence(%L, pg_temp.ev('{"hr_avg": 900}'))$$, pg_temp.get('w')),
  'P0001', 'invalid_evidence', 'an impossible heart rate is refused');
select throws_ok(format($$select public.attach_workout_evidence(%L, pg_temp.ev() - 'bundle_id')$$, pg_temp.get('w')),
  'P0001', 'invalid_evidence', 'the source app is required');
select throws_ok(format($$select public.attach_workout_evidence(%L, '"nonsense"')$$, pg_temp.get('w')),
  'P0001', 'invalid_evidence', 'the payload must be an object');

-- The record covers 26 of the 30 minutes.
select is((public.attach_workout_evidence(pg_temp.get('w')::uuid, pg_temp.ev())).overlap, 0.867, 'the server computes the overlap');
select is((select count(*)::int from public.workout_evidence), 1, 'the evidence is stored');
select is((public.attach_workout_evidence(pg_temp.get('w')::uuid, pg_temp.ev())).external_record_id, 'HK-1', 'a retried attach returns the same row');
select is((select count(*)::int from public.workout_evidence), 1, 'and adds nothing');
select throws_ok(format($$select public.attach_workout_evidence(%L, pg_temp.ev('{"id": "HK-2"}'))$$, pg_temp.get('w')),
  'P0001', 'evidence_already_attached', 'one Apple Health record per workout');

select is(pg_temp.metric(pg_temp.get('w'), 'avg_heart_rate', 'healthkit'), 151.3, 'heart rate becomes a metric');
select is(pg_temp.metric(pg_temp.get('w'), 'distance_m', 'healthkit'), 5010.4, 'distance from the watch is kept apart from phone GPS distance');
select is(pg_temp.metric(pg_temp.get('w'), 'hr_coverage', 'healthkit'), 0.8, 'heart-rate coverage = 24 of 30 minutes');
select is((select string_agg(distinct provenance, ',') from public.workout_metrics where source = 'healthkit'), 'synced',
  'platform metrics are labeled as synced, never live');
select throws_ok($$update public.workout_evidence set overlap = 1$$, '42501', null, 'clients cannot edit evidence');

-- The same Apple Health workout cannot back a second workout, for anyone.
insert into ctx select 'w2', (public.start_workout(gen_random_uuid(), 'run', now() - interval '10 minutes')).id;
select is((public.finish_workout(pg_temp.get('w2')::uuid, 1, gen_random_uuid())).state, 'submitted', 'second workout finished');
select throws_ok(format($$select public.attach_workout_evidence(%L, pg_temp.ev())$$, pg_temp.get('w2')),
  'P0001', 'evidence_already_used', 'a platform record is used once');

select pg_temp.act_as('b');
select is((select count(*)::int from public.workout_evidence), 0, 'others cannot see the evidence');
select throws_ok(format($$select public.attach_workout_evidence(%L, pg_temp.ev('{"id": "HK-9"}'))$$, pg_temp.get('w')),
  'P0001', 'workout_not_found', 'others cannot attach evidence to the workout');

set local role anon;
select throws_ok($$select public.attach_workout_evidence(gen_random_uuid(), '{}')$$, '42501', null, 'anonymous visitors cannot attach evidence');

select * from finish();
rollback;

begin;
select plan(14);

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@example.com' from generate_series(1, 4) n;
update public.profile_private set home_timezone = 'UTC';
update public.profiles set display_name = 'Athlete ' || right(id::text, 1);
select public.set_scoring_active('v1', '2026-01-01');

-- Athlete 1 captains a squad with athlete 2; athletes 3 and 4 are unrelated.
insert into public.squads (id, name, city, city_id, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Leavers', 'x', 5419384, '00000000-0000-0000-0000-000000000001');
insert into public.squad_members (squad_id, user_id, role, joined_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'captain', now() - interval '30 days'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'member', now() - interval '20 days');

-- A scored workout for athlete 1 (with a GPS point), and points in the ledger for the squad.
insert into public.workout_sessions (id, user_id, client_session_id, activity, state, started_at, ended_at, active_seconds, home_timezone, local_date, squad_id)
values ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', gen_random_uuid(), 'run', 'submitted',
        now() - interval '2 hours', now() - interval '1 hour', 3600, 'UTC', current_date, 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.workout_route_points (session_id, recorded_at, latitude, longitude, accuracy_m)
values ('bbbbbbbb-0000-0000-0000-000000000001', now() - interval '90 minutes', 37.1, -113.5, 5);
insert into public.points_ledger (user_id, squad_id, season, local_date, source_type, source_id, rule_version, kind, points, reason) values
  ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 2026, current_date, 'workout', 'bbbbbbbb-0000-0000-0000-000000000001', 'v1', 'award', 214, 'test'),
  ('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 2026, current_date, 'workout', gen_random_uuid(), 'v1', 'award', 200, 'test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', true);

select lives_ok($$select public.delete_my_account()$$, 'an athlete can delete their account');

reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-000000000001'), 0, 'the sign-in is gone');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-000000000001'), 0, 'the profile is gone');
select is((select count(*)::int from public.profile_private where user_id = '00000000-0000-0000-0000-000000000001'), 0, 'private settings are gone');
select is((select count(*)::int from public.workout_sessions where user_id = '00000000-0000-0000-0000-000000000001'), 0, 'workouts are gone');
select is((select count(*)::int from public.workout_route_points), 0, 'GPS points are gone');
select is((select count(*)::int from public.squad_members where user_id = '00000000-0000-0000-0000-000000000001'), 0, 'squad memberships are gone');
select is((select role from public.squad_members where user_id = '00000000-0000-0000-0000-000000000002' and left_at is null), 'captain',
  'the remaining member became captain');
select is((select count(*)::int || '/' || sum(points) from public.points_ledger where squad_id = 'aaaaaaaa-0000-0000-0000-000000000001'), '2/414',
  'the squad keeps the points it earned');
select is((select count(*)::int from public.points_ledger where user_id is null), 1, 'the deleted athlete''s ledger row no longer points at a person');
select is((select created_by from public.squads where id = 'aaaaaaaa-0000-0000-0000-000000000001'), null, 'the squad no longer names its creator');
select is((select count(*)::int from auth.users), 3, 'nobody else was deleted');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004"}', true);
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-000000000004'), 1, 'other athletes are untouched');
set local role anon;
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'anonymous visitors cannot delete anything');

select * from finish();
rollback;

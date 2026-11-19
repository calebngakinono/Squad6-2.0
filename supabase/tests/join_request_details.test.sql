begin;
select plan(14);

-- Join request notes and what the captain sees (supabase/migrations/*_join_request_details.sql).
-- u1 captains a squad; u2 asks to join with a note; u3 is an outsider.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@example.com' from generate_series(1, 4) n;

create function pg_temp.act_as(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || n)::text, true);
$$;
create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-00000000000' || n)::uuid;
$$;
grant execute on function pg_temp.act_as(int), pg_temp.uid(int) to authenticated, anon;
create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;
create function pg_temp.get(key text) returns text language sql as $$ select v from ctx where k = key $$;
grant execute on function pg_temp.get(text) to authenticated;

-- u2's real record this season (written as the database owner, as the scoring engine would):
-- two accepted workouts and one waiting for review, 340 points.
update public.profiles set display_name = 'Sam', city_id = 5419384 where id = pg_temp.uid(2);
update public.profile_private set home_timezone = 'UTC' where user_id = pg_temp.uid(2);
insert into public.workout_sessions (id, user_id, client_session_id, activity, state, started_at, ended_at, active_seconds, home_timezone, local_date)
select ('20000000-0000-0000-0000-00000000000' || d)::uuid, pg_temp.uid(2), gen_random_uuid(), 'run', 'submitted',
       now() - make_interval(hours => d), now() - make_interval(hours => d) + interval '30 minutes', 1800, 'UTC',
       (now() at time zone 'UTC')::date
from generate_series(1, 3) d;
insert into public.workout_scores (session_id, rule_version, status, categories, base, total)
values ('20000000-0000-0000-0000-000000000001', 'v1', 'accepted', '{location}', 170, 170),
       ('20000000-0000-0000-0000-000000000002', 'v1', 'accepted', '{location}', 170, 170),
       ('20000000-0000-0000-0000-000000000003', 'v1', 'needs_review', '{}', 0, 0);
insert into public.points_ledger (user_id, season, local_date, source_type, source_id, rule_version, kind, points, reason)
select pg_temp.uid(2), extract(year from now() at time zone 'UTC')::int, (now() at time zone 'UTC')::date, 'workout',
       ('20000000-0000-0000-0000-00000000000' || d)::uuid, 'v1', 'award', 170, 'test'
from generate_series(1, 2) d;

set local role authenticated;

select pg_temp.act_as(1);
insert into ctx values ('squad', public.create_squad('Dawn Patrol', 5419384, 'Early runs'));
insert into ctx values ('code', (select code from public.squad_invite_codes where squad_id = pg_temp.get('squad')::uuid));

-- The note -------------------------------------------------------------------------------------------
select pg_temp.act_as(2);
select throws_ok(format($$select public.request_to_join(%L, repeat('x', 281))$$, pg_temp.get('code')), 'P0001', 'note_too_long',
  'a note longer than 280 characters is refused');
insert into ctx values ('req', public.request_to_join(pg_temp.get('code'), '  I run 3x a week, mostly mornings.  '));
select is((select note from public.squad_join_requests where id = pg_temp.get('req')::uuid), 'I run 3x a week, mostly mornings.',
  'the note is stored, trimmed');
select is(public.request_to_join(pg_temp.get('code'), 'Also happy to do Saturday long runs.')::text, pg_temp.get('req'),
  'asking again returns the same request');
select is((select note from public.squad_join_requests where id = pg_temp.get('req')::uuid), 'Also happy to do Saturday long runs.',
  'and a new note replaces the old one');
select is(public.request_to_join(pg_temp.get('code'), '   ')::text, pg_temp.get('req'), 'a blank note is allowed');
select is((select note from public.squad_join_requests where id = pg_temp.get('req')::uuid), 'Also happy to do Saturday long runs.',
  'and does not wipe the earlier note');
select throws_ok($$update public.squad_join_requests set note = 'edited'$$, '42501', null, 'clients cannot edit a note directly');

-- What the captain sees ------------------------------------------------------------------------------
select pg_temp.act_as(1);
select is(
  (select row(d.display_name, d.note, d.city, d.season_workouts, d.season_points)::text
   from public.squad_join_request_details(pg_temp.get('squad')::uuid) d),
  row('Sam', 'Also happy to do Saturday long runs.', (select name from public.cities where id = 5419384), 2, 340::bigint)::text,
  'the captain sees name, note, city, accepted workouts and points this season');
select is((select season from public.squad_join_request_details(pg_temp.get('squad')::uuid)),
  extract(year from now() at time zone 'UTC')::int, 'for the current season');
select ok((select member_since is not null from public.squad_join_request_details(pg_temp.get('squad')::uuid)),
  'and how long they have been on Squad Six');
select is((select note from public.squad_join_requests where id = pg_temp.get('req')::uuid), 'Also happy to do Saturday long runs.',
  'the captain can read the note on the request');

-- Nobody else ----------------------------------------------------------------------------------------
select pg_temp.act_as(3);
select is((select count(*)::int from public.squad_join_request_details(pg_temp.get('squad')::uuid)), 0,
  'someone who is not the captain gets no request details');
select is((select count(*)::int from public.squad_join_requests where id = pg_temp.get('req')::uuid), 0,
  'and cannot read the request or its note');

-- Decided requests drop out ----------------------------------------------------------------------------
select pg_temp.act_as(1);
select public.decide_join_request(pg_temp.get('req')::uuid, false);
select is((select count(*)::int from public.squad_join_request_details(pg_temp.get('squad')::uuid)), 0,
  'a declined request is no longer listed');

select * from finish();
rollback;

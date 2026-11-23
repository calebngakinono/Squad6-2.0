begin;
select plan(7);

-- Season 2099 keeps the test to its own athletes. A 500, B 300, C 200 and hidden.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a4', 'a4@example.com'),
  ('00000000-0000-0000-0000-0000000000b4', 'b4@example.com'),
  ('00000000-0000-0000-0000-0000000000c4', 'c4@example.com');
update public.profiles set display_name = 'H' || substr(id::text, 35, 1)
  where id in ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000c4');
insert into public.points_ledger (user_id, season, local_date, source_type, source_id, rule_version, kind, points, reason) values
  ('00000000-0000-0000-0000-0000000000a4', 2099, '2099-06-01', 'workout', gen_random_uuid(), 'v1', 'award', 500, 'test'),
  ('00000000-0000-0000-0000-0000000000b4', 2099, '2099-06-01', 'workout', gen_random_uuid(), 'v1', 'award', 300, 'test'),
  ('00000000-0000-0000-0000-0000000000c4', 2099, '2099-06-01', 'workout', gen_random_uuid(), 'v1', 'award', 200, 'test');

create function pg_temp.board() returns text language sql as $$
  select string_agg(coalesce(rank::text, '-') || ':' || display_name || ':' || points || case when is_me then '*' else '' end, ', ')
  from public.athlete_standings(2099, 'world') where display_name like 'H_';
$$;

set local role authenticated;
-- C turns the setting on themselves.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c4"}', true);
update public.profile_private set hide_from_rankings = true where user_id = '00000000-0000-0000-0000-0000000000c4';
select is((select hide_from_rankings from public.profile_private where user_id = '00000000-0000-0000-0000-0000000000c4'), true, 'I can turn it on for myself');
select is(pg_temp.board(), '1:Ha:500, 2:Hb:300, -:Hc:200*', 'hidden: I still see my own row, unranked');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4"}', true);
select is(pg_temp.board(), '1:Ha:500*, 2:Hb:300', 'others don''t see a hidden person');
-- A cannot change C's setting (the row isn't theirs) or read it.
update public.profile_private set hide_from_rankings = false where user_id = '00000000-0000-0000-0000-0000000000c4';
select is((select count(*)::int from public.profile_private where user_id = '00000000-0000-0000-0000-0000000000c4'), 0, 'nobody else can read the setting');
select throws_ok($$update public.profile_private set home_timezone = 'UTC' where user_id = '00000000-0000-0000-0000-0000000000a4'$$,
  '42501', null, 'only the allowed columns are writable');

reset role;
select is((select hide_from_rankings from public.profile_private where user_id = '00000000-0000-0000-0000-0000000000c4'), true, 'so it stays on');
select is((select coalesce(sum(points), 0)::int from public.points_ledger where user_id = '00000000-0000-0000-0000-0000000000c4' and season = 2099), 200,
  'hiding changes no points');

select * from finish();
rollback;

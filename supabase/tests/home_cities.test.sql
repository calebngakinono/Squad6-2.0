begin;
select plan(16);

-- Squad "Sharks" founded in Las Vegas (5506956) with captain A and member B. Saint George 5546220,
-- Salt Lake City 5780993. Everyone in UTC, so "this season" is the current UTC year.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'a2@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'b2@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@example.com');
update public.profile_private set home_timezone = 'UTC'
  where user_id in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2',
                    '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d2');
insert into public.squads (id, name, city_id, created_by) values
  ('5a000000-0000-0000-0000-000000000001', 'Sharks Test', 5506956, '00000000-0000-0000-0000-0000000000a2');
insert into public.squad_members (squad_id, user_id, role, joined_at) values
  ('5a000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'captain', now() - interval '30 days'),
  ('5a000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', 'member', now() - interval '30 days');

create function pg_temp.now_season() returns int language sql as $$ select extract(year from now() at time zone 'UTC')::int $$;
create function pg_temp.squad_city(season int) returns bigint language sql as $$
  select public.squad_city_for('5a000000-0000-0000-0000-000000000001', season) $$;

-- Squads -------------------------------------------------------------------------------------------
select is(pg_temp.squad_city(pg_temp.now_season()), 5506956::bigint, 'a squad competes in its founding city');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2"}', true);
select throws_ok($$select * from public.set_squad_home_city(5546220)$$, 'P0001', 'not_captain', 'only the captain can move the squad');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
select is((select from_season from public.set_squad_home_city(5546220)), pg_temp.now_season() + 1, 'a new home city starts next season');
select is((select next_city || '/' || next_from_season from public.my_squad_home_city()),
  'Saint George, Utah/' || (pg_temp.now_season() + 1), 'members see the plan');
select is((select city from public.my_squad_home_city()), 'Las Vegas, Nevada', 'and still compete in Las Vegas this season');
select lives_ok($$select * from public.set_squad_home_city(5780993)$$, 'the plan can be changed before the season starts');
reset role;
select is(pg_temp.squad_city(pg_temp.now_season()), 5506956::bigint, 'this season never moves');
select is(pg_temp.squad_city(pg_temp.now_season() + 1), 5780993::bigint, 'next season uses the latest plan: one city per season');

set local role authenticated;
select lives_ok($$select * from public.set_squad_home_city(5506956)$$, 'choosing the current city cancels the plan');
reset role;
select is(pg_temp.squad_city(pg_temp.now_season() + 1), 5506956::bigint, 'cancelled: still Las Vegas next season');

-- A past change stays with its season.
insert into public.squad_home_cities (squad_id, from_season, city_id) values ('5a000000-0000-0000-0000-000000000001', pg_temp.now_season() + 2, 5546220);
select is(pg_temp.squad_city(pg_temp.now_season() + 1), 5506956::bigint, 'a later season''s city never rewrites an earlier one');

-- The captain moving changes nothing for the squad.
update public.profiles set city_id = 5546220 where id = '00000000-0000-0000-0000-0000000000a2';
select is(pg_temp.squad_city(pg_temp.now_season()), 5506956::bigint, 'a captain moving does not move the squad');

-- People ---------------------------------------------------------------------------------------------
-- C has no points this season: a new city applies straight away.
update public.profiles set city_id = 5506956 where id = '00000000-0000-0000-0000-0000000000c2';
update public.profiles set city_id = 5546220 where id = '00000000-0000-0000-0000-0000000000c2';
select is(public.athlete_city_for('00000000-0000-0000-0000-0000000000c2', pg_temp.now_season()), 5546220::bigint,
  'before any points, a new city counts this season');

-- D earns points in Las Vegas, then moves: the board keeps Las Vegas until next season.
update public.profiles set city_id = 5506956 where id = '00000000-0000-0000-0000-0000000000d2';
insert into public.points_ledger (user_id, season, local_date, source_type, source_id, rule_version, kind, points, reason)
values ('00000000-0000-0000-0000-0000000000d2', pg_temp.now_season(), current_date, 'workout', gen_random_uuid(), 'v1', 'award', 200, 'test');
update public.profiles set city_id = 5780993 where id = '00000000-0000-0000-0000-0000000000d2';
select is(public.athlete_city_for('00000000-0000-0000-0000-0000000000d2', pg_temp.now_season()), 5506956::bigint,
  'with points this season, a move does not change this season''s board');
select is(public.athlete_city_for('00000000-0000-0000-0000-0000000000d2', pg_temp.now_season() + 1), 5780993::bigint,
  'it counts from next season');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2"}', true);
select is((select city from public.athlete_standings(pg_temp.now_season(), 'city') where is_me), 'Las Vegas, Nevada',
  'the People board shows the season''s city');

select * from finish();
rollback;

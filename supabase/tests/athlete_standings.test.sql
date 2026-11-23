begin;
select plan(12);

-- Five athletes: A and B in Denver, C in Saint George (same country), D in London, E in Denver with no
-- points, F with no city.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@example.com' from generate_series(1, 6) n;
create function pg_temp.uid(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || n)::uuid $$;
-- Season 2099 keeps the test to its own athletes, whatever else is in the database.
update public.profiles set display_name = 'Athlete ' || substr(id::text, 36, 1) where id in (select pg_temp.uid(n) from generate_series(1, 6) n);
update public.profiles set city_id = 5419384 where id in (pg_temp.uid(1), pg_temp.uid(2), pg_temp.uid(5));
update public.profiles set city_id = 5546220 where id = pg_temp.uid(3);
update public.profiles set city_id = 2643743 where id = pg_temp.uid(4);

create function pg_temp.award(n int, pts int, season int default 2099) returns void language sql as $$
  insert into public.points_ledger (user_id, season, local_date, source_type, source_id, rule_version, kind, points, reason)
  values (pg_temp.uid(n), season, make_date(season, 6, 1), 'workout', gen_random_uuid(), 'v1', 'award', pts, 'test');
$$;
select pg_temp.award(1, 300), pg_temp.award(2, 500), pg_temp.award(3, 200), pg_temp.award(4, 900);
select pg_temp.award(1, 1000, 2098); -- last season: never counts for 2099

create function pg_temp.board(scope text) returns text language sql as $$
  select string_agg(coalesce(rank::text, '-') || ':' || display_name || ':' || points || case when is_me then '*' else '' end, ', ')
  from public.athlete_standings(2099, scope);
$$;

set local role anon;
select throws_ok($$select * from public.athlete_standings(2099, 'world')$$, '42501', null, 'visitors cannot see the rankings');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', true);
select is(pg_temp.board('city'), '1:Athlete 2:500, 2:Athlete 1:300*', 'city: Denver athletes ranked by season points, mine marked');
select is(pg_temp.board('country'), '1:Athlete 2:500, 2:Athlete 1:300*, 3:Athlete 3:200', 'country adds Saint George');
select is(pg_temp.board('world'), '1:Athlete 4:900, 2:Athlete 2:500, 3:Athlete 1:300*, 4:Athlete 3:200', 'world adds London');
select is((select points from public.athlete_standings(2099, 'world') where is_me), 300::bigint, 'last season''s points stay in last season');
select ok(not exists (select 1 from public.athlete_standings(2099, 'world') where display_name = 'Athlete 5'),
  'athletes without points are not listed to others');
select is((select city from public.my_athlete_place()), 'Denver', 'my place is my own city');
select throws_ok($$select * from public.athlete_standings(2099, 'street')$$, 'P0001', 'invalid_scope', 'only city, country or world');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005"}', true);
select is(pg_temp.board('city'), '1:Athlete 2:500, 2:Athlete 1:300, -:Athlete 5:0*', 'I always see my own row, unranked at 0');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000006"}', true);
select is((select count(*)::int from public.athlete_standings(2099, 'city')), 0, 'no city yet: no city board');
select ok((select count(*) from public.athlete_standings(2099, 'world')) = 5, 'but the world board works');

reset role;
select is(
  (select string_agg(parameter_name, ',' order by ordinal_position) from information_schema.parameters
   where specific_schema = 'public' and specific_name like 'athlete\_standings\_%' and parameter_mode = 'OUT'),
  'rank,display_name,city,points,is_me',
  'others see a name, a city and points: no user ids');

select * from finish();
rollback;

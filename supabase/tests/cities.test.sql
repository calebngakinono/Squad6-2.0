begin;
select plan(18);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@example.com');
create function pg_temp.found(q text) returns text language sql as $$
  select string_agg(name || coalesce(', ' || region, '') || ' (' || country_code || ')', ' | ') from public.search_cities(q, 3);
$$;
grant execute on function pg_temp.found(text) to authenticated, anon;

select ok((select count(*) from public.cities) > 30000, 'the list holds every city over 15,000 people');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

-- Search ---------------------------------------------------------------------------------------------
select is(pg_temp.found('denv'), 'Denver, Colorado (US) | Denville, New Jersey (US)', 'search matches the start of the name, biggest city first');
select ok(pg_temp.found('st. george') like 'Saint George, Utah (US)%', '"St." finds "Saint"');
select ok(pg_temp.found('SAO PAULO') like 'São Paulo (BR)%', 'case and accents are ignored');
select ok(pg_temp.found('São Pau') like 'São Paulo (BR)%', 'typing the accent works too');
select is(pg_temp.found('d'), null, 'one letter is not enough to search');
select is(pg_temp.found('zzzzzz'), null, 'no match returns nothing');
select is(pg_temp.found('%'), null, 'wildcards are treated as plain text');
select is((select count(*)::int from public.search_cities('san', 500)), 50, 'at most 50 results');

-- Choosing a city --------------------------------------------------------------------------------------
update public.profiles set city_id = 5546220 where id = '00000000-0000-0000-0000-00000000000a';
select is((select city from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Saint George, Utah',
  'choosing a city sets the label');
select throws_ok($$update public.profiles set city = 'Atlantis'$$, '42501', null, 'a city can no longer be typed in');
select throws_ok($$update public.profiles set city_id = 1$$, '23503', null, 'a city that is not on the list is refused');
select throws_ok($$insert into public.cities (id, name, search_name, country_code, country, population) values (1, 'Atlantis', 'atlantis', 'AT', 'Nowhere', 20000)$$,
  '42501', null, 'the list cannot be changed by users');

-- Squads -----------------------------------------------------------------------------------------------
select throws_ok($$select public.create_squad('No City', null)$$, 'P0001', 'city_required', 'a squad needs a city from the list');
select throws_ok($$select public.create_squad('Bad City', 1)$$, 'P0001', 'city_required', 'and it must exist');
select lives_ok($$select public.create_squad('Red Rocks', 5546220)$$, 'a squad is created with a listed city');
select is((select city || '/' || city_id from public.squads where name = 'Red Rocks'), 'Saint George, Utah/5546220', 'the squad stores the city and its label');

set local role anon;
select throws_ok($$select * from public.search_cities('denver')$$, '42501', null, 'anonymous visitors cannot search');

select * from finish();
rollback;

begin;
select plan(22);

-- Cities: Denver 5419384 and Boulder 5574991 (US), Saint George 5546220 (US), Toronto 6167865 (CA).
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'u' || n || '@example.com' from generate_series(1, 20) n;
create function pg_temp.uid(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
select public.set_scoring_active('v1', '2025-01-01');

insert into public.squads (id, name, city, city_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Six Pack', 'x', 5419384),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Four Strong', 'x', 5419384),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Trio', 'x', 5419384),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Boulder Five', 'x', 5574991),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Maple Four', 'x', 6167865);
select is((select city from public.squads where name = 'Six Pack'), 'Denver, Colorado', 'squads carry the label of their listed city');

create function pg_temp.fill(squad text, first int, last int) returns void language sql as $$
  insert into public.squad_members (squad_id, user_id, role, joined_at)
  select squad::uuid, pg_temp.uid(n), case when n = first then 'captain' else 'member' end, '2024-12-01' from generate_series(first, last) n;
$$;
select pg_temp.fill('aaaaaaaa-0000-0000-0000-000000000001', 1, 6);   -- six members
select pg_temp.fill('aaaaaaaa-0000-0000-0000-000000000002', 7, 10);  -- four
select pg_temp.fill('aaaaaaaa-0000-0000-0000-000000000003', 11, 13); -- three: not ranked yet
select pg_temp.fill('aaaaaaaa-0000-0000-0000-000000000004', 14, 18); -- five, another city
select pg_temp.fill('aaaaaaaa-0000-0000-0000-000000000005', 19, 20); -- two so far, another country

create function pg_temp.award(n int, squad text, pts int, yr int default 2025) returns void language sql as $$
  insert into public.points_ledger (user_id, squad_id, season, local_date, source_type, source_id, rule_version, kind, points, reason)
  values (pg_temp.uid(n), squad::uuid, yr, make_date(yr, 6, 1), 'workout', gen_random_uuid(), 'v1', 'award', pts, 'test');
$$;
select pg_temp.award(n, 'aaaaaaaa-0000-0000-0000-000000000001', 4000) from generate_series(1, 6) n;   -- 24,000
select pg_temp.award(n, 'aaaaaaaa-0000-0000-0000-000000000002', 6500) from generate_series(7, 10) n;  -- 26,000
select pg_temp.award(n, 'aaaaaaaa-0000-0000-0000-000000000003', 9000) from generate_series(11, 13) n; -- 27,000
select pg_temp.award(n, 'aaaaaaaa-0000-0000-0000-000000000004', 6000) from generate_series(14, 18) n; -- 30,000
select pg_temp.award(n, 'aaaaaaaa-0000-0000-0000-000000000005', 8000) from generate_series(19, 20) n; -- 16,000
select pg_temp.award(1, 'aaaaaaaa-0000-0000-0000-000000000001', 99999, 2024); -- another season: must not leak in
-- A correction: athlete 7 loses 500.
insert into public.points_ledger (user_id, squad_id, season, local_date, source_type, source_id, rule_version, kind, revision, points, reason)
values (pg_temp.uid(7), 'aaaaaaaa-0000-0000-0000-000000000002', 2025, '2025-06-02', 'workout', gen_random_uuid(), 'v1', 'adjustment', 1, -500, 'test');

create function pg_temp.board(scope text) returns text language sql as $$
  select string_agg(coalesce(rank::text, '-') || ' ' || name || ' ' || points, ', ' order by rank nulls last, points desc)
  from public.squad_standings(2025, scope);
$$;
grant execute on function pg_temp.uid(int), pg_temp.board(text) to authenticated, anon;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(1))::text, true);

-- An athlete's own season ----------------------------------------------------------------------------
select is(public.my_season_points(2025), 4000::bigint, 'an athlete sees their own season total (other seasons do not leak in)');
select is(public.my_season_points(2031), 0::bigint, 'a season with no points is zero, not an error');
select is((select city || '/' || country_code from public.my_standings_place()), 'Denver/US', 'standings are centred on the squad''s city');

-- Squads: plain total, ranked from 4 members ---------------------------------------------------------
select is(pg_temp.board('city'), '1 Four Strong 25500, 2 Six Pack 24000, - Trio 27000',
  'city: squads rank by total points; a squad of three is listed with its points but not ranked');
select is(pg_temp.board('country'), '1 Boulder Five 30000, 2 Four Strong 25500, 3 Six Pack 24000, - Trio 27000',
  'country: every squad in the same country');
select is(pg_temp.board('world'), '1 Boulder Five 30000, 2 Four Strong 25500, 3 Six Pack 24000, - Trio 27000, - Maple Four 16000',
  'world: every squad, unranked ones last');
select is((select name from public.squad_standings(2025, 'city') where is_mine), 'Six Pack', 'my squad is marked');
select is((select members || '/' || is_ranked::text from public.squad_standings(2025, 'world') where name = 'Trio'), '3/false', 'three members: not ranked');
select is((select count(*)::int from public.squad_standings(2025, 'world', 1) where is_ranked), 2,
  'my squad comes back even when it is outside the top');
select throws_ok($$select * from public.squad_standings(2025, 'galaxy')$$, 'P0001', 'invalid_scope', 'only city, country and world exist');
select is((select count(*)::int from public.squad_standings(2031, 'world')), 1, 'a season with no points lists only my own squad');

-- The fourth member joins: the squad becomes ranked and brings every point it already earned.
reset role;
insert into auth.users (id, email) values (pg_temp.uid(21), 'u21@example.com');
insert into public.squad_members (squad_id, user_id, role) values ('aaaaaaaa-0000-0000-0000-000000000003', pg_temp.uid(21), 'member');
set local role authenticated;
select is(pg_temp.board('city'), '1 Trio 27000, 2 Four Strong 25500, 3 Six Pack 24000',
  'with a fourth member the squad is ranked with all the points it earned before');

-- Every member counts; nobody can be kicked to improve the score, and points do not travel.
reset role;
update public.squad_members set left_at = now(), left_reason = 'removed'
  where user_id = pg_temp.uid(6) and squad_id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into public.squad_members (squad_id, user_id, role) values ('aaaaaaaa-0000-0000-0000-000000000005', pg_temp.uid(6), 'member');
select pg_temp.award(6, 'aaaaaaaa-0000-0000-0000-000000000005', 300);
set local role authenticated;
select is((select points || '/' || members from public.squad_standings(2025, 'world') where name = 'Six Pack'), '24000/5',
  'removing a member changes nothing: the points they earned stay with the squad');
select is((select points from public.squad_standings(2025, 'world') where name = 'Maple Four'), 16300::bigint,
  'the new squad gets only what the athlete earns after joining');
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(6))::text, true);
select is(public.my_season_points(2025), 4300::bigint, 'the athlete keeps every point they earned, across squads');
select is((select country_code from public.my_standings_place()), 'CA', 'and their standings now centre on the new squad''s city');
select is(pg_temp.board('country'), '- Maple Four 16300', 'a different country has its own board');

-- An athlete without a squad or a city: world works, city and country are empty.
reset role;
insert into auth.users (id, email) values (pg_temp.uid(22), 'u22@example.com');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(22))::text, true);
select is((select count(*)::int from public.squad_standings(2025, 'city')) + (select count(*)::int from public.squad_standings(2025, 'country')), 0,
  'no city chosen: no city or country board');
select is((select count(*)::int from public.squad_standings(2025, 'world')), 5, 'the world board still works');

-- Access -------------------------------------------------------------------------------------------
select is((select count(*)::int from public.points_ledger), 0, 'the ledger stays private: nobody sees another athlete''s rows');
set local role anon;
select throws_ok($$select * from public.squad_standings(2025, 'world')$$, '42501', null, 'anonymous visitors cannot read standings');

select * from finish();
rollback;

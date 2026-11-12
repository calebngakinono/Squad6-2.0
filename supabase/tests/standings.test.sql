begin;
select plan(19);

-- Season 2025 is over, so its window is the whole year (365 days) and the numbers are fixed.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'u' || n || '@example.com' from generate_series(1, 12) n;
create function pg_temp.uid(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
update public.profiles set display_name = 'Athlete ' || right(id::text, 2), city = case when right(id::text, 2)::int <= 8 then 'Denver' else ' st. george ' end;
select public.set_scoring_active('v1', '2025-01-01');

insert into public.squads (id, name, city) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Six Pack', 'Denver'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Four Strong', 'Denver'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Duo', 'St. George'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Revolving Door', 'St. George');

-- Six Pack: athletes 1-6 all year. Four Strong: 7-10 all year. Duo: 11-12 all year (too small to rank).
insert into public.squad_members (squad_id, user_id, role, joined_at)
select 'aaaaaaaa-0000-0000-0000-000000000001', pg_temp.uid(n), case when n = 1 then 'captain' else 'member' end, '2024-12-01' from generate_series(1, 6) n;
insert into public.squad_members (squad_id, user_id, role, joined_at)
select 'aaaaaaaa-0000-0000-0000-000000000002', pg_temp.uid(n), case when n = 7 then 'captain' else 'member' end, '2024-12-01' from generate_series(7, 10) n;
insert into public.squad_members (squad_id, user_id, role, joined_at)
select 'aaaaaaaa-0000-0000-0000-000000000003', pg_temp.uid(n), case when n = 11 then 'captain' else 'member' end, '2024-12-01' from generate_series(11, 12) n;

create function pg_temp.award(n int, squad text, pts int, yr int default 2025) returns void language sql as $$
  insert into public.points_ledger (user_id, squad_id, season, local_date, source_type, source_id, rule_version, kind, points, reason)
  values (pg_temp.uid(n), squad::uuid, yr, make_date(yr, 6, 1), 'workout', gen_random_uuid(), 'v1', 'award', pts, 'test');
$$;
-- Six Pack members average 5,000; Four Strong members average 6,000; Duo 9,000 each.
select pg_temp.award(n, 'aaaaaaaa-0000-0000-0000-000000000001', 3000 + n * 571) from generate_series(1, 6) n; -- 3571 .. 6426, total 29991
select pg_temp.award(n, 'aaaaaaaa-0000-0000-0000-000000000002', 6000) from generate_series(7, 10) n;
select pg_temp.award(n, 'aaaaaaaa-0000-0000-0000-000000000003', 9000) from generate_series(11, 12) n;
select pg_temp.award(1, 'aaaaaaaa-0000-0000-0000-000000000001', 99999, 2024); -- another season: must not leak in
-- A correction: athlete 7 loses 500.
insert into public.points_ledger (user_id, squad_id, season, local_date, source_type, source_id, rule_version, kind, revision, points, reason)
values (pg_temp.uid(7), 'aaaaaaaa-0000-0000-0000-000000000002', 2025, '2025-06-02', 'workout', gen_random_uuid(), 'v1', 'adjustment', 1, -500, 'test');

grant execute on function pg_temp.uid(int) to authenticated, anon;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(1))::text, true);

-- Athletes -----------------------------------------------------------------------------------------
select is((select count(*)::int from public.athlete_standings(2025)), 12, 'every athlete with points is listed');
select is((select string_agg(right(user_id::text, 2), ',' order by rank, user_id) from public.athlete_standings(2025) where rank <= 3),
  '11,12,06', 'ranked by points; ties share a rank');
select is((select points from public.athlete_standings(2025) where right(user_id::text, 2) = '07'), 5500::bigint, 'adjustments are included');
select is((select points from public.athlete_standings(2025) where is_me), 3571::bigint, 'other seasons do not leak in');
select is((select count(*)::int from public.athlete_standings(2025, 'ST. GEORGE')), 4, 'city filter ignores case and spaces (and I am not listed in a city that is not mine)');
select is((select rank || '/' || is_me::text from public.athlete_standings(2025, 'denver', 3) where is_me), '8/true',
  'my own row comes back even when I am outside the top');
select is((select count(*)::int from public.athlete_standings(2025, null, 3)), 4, 'top 3 plus me');

-- Squads -------------------------------------------------------------------------------------------
select is((select string_agg(name || ':' || score, ', ' order by rank) from public.squad_standings(2025) where is_ranked),
  'Four Strong:5875, Six Pack:4999', 'squads rank by average per member: four at 5,875 beat six at 4,999');
select is((select name || '/' || coalesce(rank::text, 'unranked') || '/' || score from public.squad_standings(2025) where not is_ranked),
  'Duo/unranked/9000', 'a squad of two is listed with its score but not ranked');
select is((select name from public.squad_standings(2025) where is_mine), 'Six Pack', 'my squad is marked');
select is((select count(*)::int from public.squad_standings(2025, 'st. george')), 1, 'city filter: only that city''s squads');
select is((select count(*)::int from public.squad_standings(2099)), 0, 'a season that has not started has no standings');

-- Kicking a low scorer does not raise the average: their days and their points both stay.
reset role;
update public.squad_members set left_at = '2025-12-20', left_reason = 'removed'
  where user_id = pg_temp.uid(1) and squad_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(2))::text, true);
select is((select score || '/' || members from public.squad_standings(2025) where name = 'Six Pack'), '5024/5',
  'removing the lowest scorer in late December barely moves the score (their 354 days still count as a seat)');

-- A member who joined mid-season counts for the share of the season they were there.
reset role;
insert into public.squad_members (squad_id, user_id, role, joined_at, left_at, left_reason) values
  ('aaaaaaaa-0000-0000-0000-000000000004', pg_temp.uid(1), 'captain', '2025-12-21', null, null);
select pg_temp.award(1, 'aaaaaaaa-0000-0000-0000-000000000004', 300);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(1))::text, true);
select is((select score from public.squad_standings(2025) where name = 'Revolving Door'), 9955::bigint,
  '11 days in the squad = 11/365 of a seat: 300 points ÷ 0.0301');
select is((select points from public.athlete_standings(2025) where is_me), 3871::bigint, 'the athlete keeps every point they earned, across squads');

-- A deleted account: the points still count for the squad, but no person is listed.
reset role;
delete from auth.users where id = pg_temp.uid(10);
set local role authenticated;
select is((select count(*)::int from public.athlete_standings(2025) where right(user_id::text, 2) = '10'), 0, 'a deleted athlete is not listed');
select is((select points from public.squad_standings(2025) where name = 'Four Strong'), 23500::bigint, 'but their points stay in the squad total');

-- Access -------------------------------------------------------------------------------------------
select is((select count(*)::int from public.points_ledger), 3, 'the ledger itself stays private: only my own rows');
set local role anon;
select throws_ok($$select * from public.athlete_standings(2025)$$, '42501', null, 'anonymous visitors cannot read standings');

select * from finish();
rollback;

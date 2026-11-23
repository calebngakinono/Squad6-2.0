begin;
select plan(66);

-- Official challenges (supabase/migrations/*_challenges.sql, docs/scoring-proposal.md §5).
-- Week under test: Monday 2026-06-01 to Sunday 2026-06-07, athletes in UTC unless stated.
-- Workouts are built directly (as the database owner) with the measurements each case needs, then the
-- athlete's day is scored with score_day(), which is what the app's finish path runs.

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'u' || n || '@example.com' from generate_series(1, 29) n;
update public.profile_private set home_timezone = 'UTC';
update public.profile_private set home_timezone = 'America/Denver' where user_id = '00000000-0000-0000-0000-000000000026';

create function pg_temp.uid(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;

-- A finished workout on day `day` of the week (07:00 UTC), scored straight away.
--   km:        GPS distance (location evidence); null = no GPS
--   manual_km: a hand-entered distance (must never count)
-- Every workout also has phone steps (motion evidence), so it is accepted unless it is implausible.
create function pg_temp.workout(n int, day int, km numeric default 4, minutes int default 30, squad uuid default null,
                                activity text default 'run', manual_km numeric default null)
returns uuid language plpgsql as $$
declare
  id uuid := gen_random_uuid();
  t0 timestamptz := timestamptz '2026-06-01 07:00:00+00' + make_interval(days => day);
begin
  insert into public.workout_sessions (id, user_id, client_session_id, activity, state, started_at, ended_at, active_seconds, home_timezone, local_date, squad_id)
  values (id, pg_temp.uid(n), gen_random_uuid(), activity, 'submitted', t0, t0 + make_interval(mins => minutes), minutes * 60, 'UTC',
          date '2026-06-01' + day, squad);
  if km is not null then
    insert into public.workout_metrics (session_id, metric, value, source, provenance) values
      (id, 'distance_m', km * 1000, 'gps', 'live'), (id, 'gps_coverage', 0.95, 'gps', 'live'),
      (id, 'gps_points', 1000, 'gps', 'live'), (id, 'gps_excluded_m', 0, 'gps', 'live'), (id, 'gps_mocked_points', 0, 'gps', 'live');
  end if;
  if manual_km is not null then
    insert into public.workout_metrics (session_id, metric, value, source, provenance) values (id, 'distance_m', manual_km * 1000, 'manual', 'manual');
  end if;
  insert into public.workout_metrics (session_id, metric, value, source, provenance) values
    (id, 'steps', 4000, 'pedometer', 'live'), (id, 'motion_coverage', 0.9, 'pedometer', 'live');
  perform public.score_day(pg_temp.uid(n), date '2026-06-01' + day);
  return id;
end;
$$;
create function pg_temp.join(n int, challenge text, at timestamptz default '2026-06-01 00:00:00+00', week text default 'current')
returns uuid language sql as $$ select (public.challenge_join_at(pg_temp.uid(n), challenge, week, at)).id $$;
-- Challenge points paid to athlete n.
create function pg_temp.cpoints(n int) returns int language sql as $$
  select coalesce(sum(points), 0)::int from public.points_ledger where user_id = pg_temp.uid(n) and source_type = 'challenge';
$$;
create function pg_temp.tier(n int, challenge text default 'weekly-tiers-v1') returns text language sql as $$
  select coalesce(tier, 'none') from public.challenge_participants where user_id = pg_temp.uid(n) and challenge_id = challenge and week_start = '2026-06-01';
$$;
create function pg_temp.fill(squad uuid, first int, last int) returns void language sql as $$
  insert into public.squad_members (squad_id, user_id, role, joined_at)
  select squad, pg_temp.uid(n), case when n = first then 'captain' else 'member' end, timestamptz '2026-05-01' from generate_series(first, last) n;
$$;
create temp table w (k text primary key, id uuid);

-- Scoring switched off ---------------------------------------------------------------------------------
-- Even with accepted workouts on record, nothing is awarded while no rule version is active.
select pg_temp.join(20, 'weekly-tiers-v1');
insert into public.workout_sessions (id, user_id, client_session_id, activity, state, started_at, ended_at, active_seconds, home_timezone, local_date)
select ('20000000-0000-0000-0000-00000000000' || d)::uuid, pg_temp.uid(20), gen_random_uuid(), 'run', 'submitted',
       timestamptz '2026-06-01 07:00+00' + make_interval(days => d), timestamptz '2026-06-01 07:30+00' + make_interval(days => d), 1800, 'UTC', date '2026-06-01' + d
from generate_series(0, 2) d;
insert into public.workout_scores (session_id, rule_version, status, categories, base, total)
select ('20000000-0000-0000-0000-00000000000' || d)::uuid, 'v1', 'accepted', '{location}', 170, 170 from generate_series(0, 2) d;
select public.challenge_evaluate(pg_temp.uid(20), '2026-06-03');
select is(pg_temp.cpoints(20), 0, 'scoring off: three accepted workouts award no challenge points');
select is(pg_temp.tier(20), 'none', 'scoring off: no tier is recorded');

select public.set_scoring_active('v1', '2026-01-01');

-- Weekly tiers -------------------------------------------------------------------------------------------
select pg_temp.join(1, 'weekly-tiers-v1');
select pg_temp.workout(1, 0), pg_temp.workout(1, 1);
select is(pg_temp.cpoints(1), 0, 'two accepted workouts: no tier yet');
select pg_temp.workout(1, 2);
select is(pg_temp.tier(1), 'bronze', 'three accepted workouts: bronze');
select is(pg_temp.cpoints(1), 40, 'bronze pays 40');
-- Athlete 1 is in no squad: weekly tiers are open to everyone (Caleb, 2026-11-22). Squad week is not.
select is((select squad_id from public.challenge_participants where user_id = pg_temp.uid(1) and challenge_id = 'weekly-tiers-v1'), null,
  'weekly tiers work without a squad');
select pg_temp.workout(1, 3);
select pg_temp.workout(1, 4);
select is(pg_temp.tier(1), 'silver', 'five accepted workouts: silver');
select is(pg_temp.cpoints(1), 80, 'silver tops up to 80, not 40 + 80');
select pg_temp.workout(1, 5, 5);
select is(pg_temp.tier(1), 'gold', '25 km of GPS run distance: gold');
select is(pg_temp.cpoints(1), 120, 'gold tops up to 120');
select is((select (distance_m ->> 'run')::int from public.challenge_participants where user_id = pg_temp.uid(1)), 25000, 'validated running distance is stored');
select is(
  (select string_agg(c.challenge_id || '/' || a.tier || '/' || l.rule_version || '/' || l.kind || ':' || l.points, ', ' order by l.id)
   from public.points_ledger l join public.challenge_awards a on a.id = l.source_id join public.challenge_participants c on c.id = a.participant_id
   where l.user_id = pg_temp.uid(1) and l.source_type = 'challenge'),
  'weekly-tiers-v1/bronze/v1/award:40, weekly-tiers-v1/silver/v1/award:40, weekly-tiers-v1/gold/v1/award:40',
  'every award is a ledger row traceable to the challenge, tier and rule version');
select is((select sum(points)::int from public.points_ledger where user_id = pg_temp.uid(1) and source_type = 'workout') > 0, true,
  'workout points are paid as before');

-- Idempotent, and a tier can never be paid twice.
select public.score_day(pg_temp.uid(1), '2026-06-06');
select public.challenge_evaluate(pg_temp.uid(1), '2026-06-06');
select is((select count(*)::int from public.points_ledger where user_id = pg_temp.uid(1) and source_type = 'challenge'), 3,
  're-evaluating writes nothing new');
select throws_ok(format($$insert into public.points_ledger (user_id, season, local_date, source_type, source_id, rule_version, kind, points, reason)
  values (%L, 2026, '2026-06-01', 'challenge', %L, 'v1', 'award', 120, 'again')$$, pg_temp.uid(1),
  (select a.id from public.challenge_awards a join public.challenge_participants c on c.id = a.participant_id where c.user_id = pg_temp.uid(1) and a.tier = 'gold')),
  '23505', null, 'the ledger refuses a second award for the same tier');
select throws_ok(format($$insert into public.challenge_awards (participant_id, tier, tier_points, rule_version) values (%L, 'gold', 120, 'v1')$$,
  (select id from public.challenge_participants where user_id = pg_temp.uid(1))),
  '23505', null, 'a participant reaches each tier once');

-- Gold straight away: the highest tier only, paid once.
select pg_temp.join(2, 'weekly-tiers-v1');
select pg_temp.workout(2, d, 9, 60) from generate_series(0, 2) d;
select is(pg_temp.tier(2), 'gold', '27 km in three runs: gold');
select is((select string_agg(kind || ':' || points, ',') from public.points_ledger where user_id = pg_temp.uid(2) and source_type = 'challenge'),
  'award:120', 'gold reached together with bronze pays 120 once, not 40 + 120');

-- Manual distance never counts.
select pg_temp.join(3, 'weekly-tiers-v1');
select pg_temp.workout(3, d, null, 40, null, 'walk', 10) from generate_series(0, 2) d;
select is(pg_temp.tier(3), 'bronze', 'three accepted walks with step evidence: bronze');
select is((select (distance_m ->> 'walk_hike')::int from public.challenge_participants where user_id = pg_temp.uid(3)), 0,
  '30 km of hand-entered distance counts for nothing');

-- Gold for walking and hiking needs 40 km (Caleb, 2026-11-18), and goals don't mix.
select pg_temp.join(27, 'weekly-tiers-v1');
select pg_temp.workout(27, d, 10, 120, null, 'walk') from generate_series(0, 2) d;
select is(pg_temp.tier(27), 'bronze', '30 km of GPS walking: bronze, not gold (walking needs 40 km)');
select is((select (distance_m ->> 'walk_hike')::int from public.challenge_participants where user_id = pg_temp.uid(27)), 30000,
  'walking distance is stored under walk_hike');
select pg_temp.join(28, 'weekly-tiers-v1');
select pg_temp.workout(28, 0, 20, 300, null, 'hike'), pg_temp.workout(28, 1, 20, 300, null, 'walk');
select is(pg_temp.tier(28), 'gold', '20 km hiking + 20 km walking = 40 km: gold');
select pg_temp.join(29, 'weekly-tiers-v1');
select pg_temp.workout(29, 0, 15, 90, null, 'run'), pg_temp.workout(29, 1, 24, 300, null, 'walk');
select is(pg_temp.tier(29), 'none', '15 km running + 24 km walking: neither goal met, so no gold');

-- No retroactive workouts: only workouts started after joining.
select pg_temp.workout(4, 0);                                -- Monday 07:00, before joining
select pg_temp.join(4, 'weekly-tiers-v1', '2026-06-01 12:00+00');
select pg_temp.workout(4, 1), pg_temp.workout(4, 2);
select is((select accepted_workouts from public.challenge_participants where user_id = pg_temp.uid(4)), 2, 'a workout from before joining is not counted');
select is(pg_temp.cpoints(4), 0, 'so two workouts after joining earn no tier');

-- Joining --------------------------------------------------------------------------------------------------
select throws_ok($$select pg_temp.join(5, 'weekly-tiers-v1', '2026-06-02 18:00:01+00')$$, 'P0001', 'join_window_closed',
  'after the first 25 % of the week (Tuesday 18:00) it is too late to join');
select pg_temp.join(5, 'weekly-tiers-v1', '2026-06-02 18:00:01+00', 'next');
select is((select week_start from public.challenge_participants where user_id = pg_temp.uid(5)),
  date '2026-06-08', 'but next week can be joined before it starts');
select lives_ok($$select pg_temp.join(6, 'weekly-tiers-v1', '2026-06-02 17:59+00')$$, 'joining inside the first 25 % works');
select is(pg_temp.join(6, 'weekly-tiers-v1', '2026-06-02 17:59+00'), (select id from public.challenge_participants where user_id = pg_temp.uid(6)),
  'joining twice returns the same entry');
select pg_temp.join(26, 'weekly-tiers-v1', '2026-06-02 23:30+00');
select is((select week_starts_at from public.challenge_participants where user_id = pg_temp.uid(26)),
  timestamptz '2026-06-01 06:00+00', 'the week follows the home time zone: Tuesday 17:30 in Denver is still inside the window');
select throws_ok($$select pg_temp.join(5, 'squad-week-v1', '2026-06-01 00:00+00')$$, 'P0001', 'not_in_squad', 'a squad challenge needs a squad');
select throws_ok($$select public.challenge_join_at(pg_temp.uid(5), 'weekly-tiers-v1', 'someday', now())$$, 'P0001', 'invalid_week', 'week must be current or next');

-- At most 3 official challenges per athlete per week. (Test-only templates, not running in later weeks.)
insert into public.challenges (id, kind, title, description, config, available_from, available_until, sort_order)
select 'test-' || x, 'individual_tiered', 'Test ' || x, 'Test only',
       '{"distance_goals": [], "tiers": [{"tier": "big", "points": 200, "measure": "accepted_workouts", "target": 3}]}',
       '2026-06-01', '2026-06-01', 0
from unnest(array['big', 'c', 'd']) x;
select pg_temp.join(7, 'weekly-tiers-v1'), pg_temp.join(7, 'test-big'), pg_temp.join(7, 'test-c');
select throws_ok($$select pg_temp.join(7, 'test-d')$$, 'P0001', 'too_many_challenges', 'a fourth challenge in the same week is refused');

-- The weekly cap of 250 challenge points per athlete.
select pg_temp.join(8, 'weekly-tiers-v1'), pg_temp.join(8, 'test-big');
select pg_temp.workout(8, d) from generate_series(0, 2) d;
select is(pg_temp.cpoints(8), 240, 'three workouts: 200 (test) + 40 (bronze)');
select pg_temp.workout(8, d) from generate_series(3, 4) d;
select is(pg_temp.tier(8), 'silver', 'five workouts: silver is reached');
select is(pg_temp.cpoints(8), 250, 'but challenge points stop at 250 for the week');

-- A flagged workout counts once a person accepts it, and stops counting if it is rejected.
select pg_temp.join(25, 'weekly-tiers-v1');
insert into w values ('r0', pg_temp.workout(25, 0, 2)), ('r1', pg_temp.workout(25, 1, 2)), ('r2', pg_temp.workout(25, 2, 13)); -- 26 km/h
select is(pg_temp.cpoints(25), 0, 'a workout waiting for review does not count');
select public.review_workout((select id from w where k = 'r2'), 'accepted', 'Checked the route', 'Caleb');
select is(pg_temp.tier(25), 'bronze', 'accepted in review: bronze');
select is(pg_temp.cpoints(25), 40, 'and bronze is paid');
select public.review_workout((select id from w where k = 'r1'), 'rejected', 'Not a real run', 'Caleb');
select is((select string_agg(kind || ':' || points, ',' order by id) from public.points_ledger where user_id = pg_temp.uid(25) and source_type = 'challenge'),
  'award:40,adjustment:-40', 'a counted workout rejected later: a reversing row, the award is never edited');

-- Squad week ---------------------------------------------------------------------------------------------
insert into public.squads (id, name, city, city_id) values
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Four', 'x', 5419384),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Six', 'x', 5419384),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Three', 'x', 5419384);
select pg_temp.fill('aaaaaaaa-0000-0000-0000-000000000004', 9, 12);
select pg_temp.fill('aaaaaaaa-0000-0000-0000-000000000006', 13, 18);
select pg_temp.fill('aaaaaaaa-0000-0000-0000-000000000003', 21, 23);
insert into public.squad_members (squad_id, user_id, role, joined_at)
values ('aaaaaaaa-0000-0000-0000-000000000003', pg_temp.uid(24), 'member', '2026-06-03 12:00+00'); -- joins on Wednesday

-- Squad of 4: 3 of 4 must each do 3 workouts.
select pg_temp.join(n, 'squad-week-v1') from generate_series(9, 11) n;
select is((select roster || '/' || required from public.challenge_squad_status('squad-week-v1', 'aaaaaaaa-0000-0000-0000-000000000004', '2026-06-01')),
  '4/3', 'squad of 4: 3 members needed');
select pg_temp.workout(n, d, 4, 30, 'aaaaaaaa-0000-0000-0000-000000000004') from generate_series(9, 10) n, generate_series(0, 2) d;
select is(pg_temp.cpoints(9) + pg_temp.cpoints(10), 0, 'two of four done: nothing yet');
select pg_temp.workout(11, d, 4, 30, 'aaaaaaaa-0000-0000-0000-000000000004') from generate_series(0, 2) d;
select is(array[pg_temp.cpoints(9), pg_temp.cpoints(10), pg_temp.cpoints(11), pg_temp.cpoints(12)], array[60, 60, 60, 0],
  'the third member completes it: 60 to each member who did, including the two who finished earlier');
select is((select sum(points)::int from public.points_ledger where squad_id = 'aaaaaaaa-0000-0000-0000-000000000004' and source_type = 'challenge'), 180,
  'the awards carry the squad, so they count toward its score');

-- Squad of 6: 4 of 6 needed.
select pg_temp.join(n, 'squad-week-v1') from generate_series(13, 16) n;
select is((select required from public.challenge_squad_status('squad-week-v1', 'aaaaaaaa-0000-0000-0000-000000000006', '2026-06-01')), 4,
  'squad of 6: 4 members needed');
select pg_temp.workout(n, d, 4, 30, 'aaaaaaaa-0000-0000-0000-000000000006') from generate_series(13, 15) n, generate_series(0, 2) d;
select is(pg_temp.cpoints(13) + pg_temp.cpoints(14) + pg_temp.cpoints(15), 0, 'three of six done: nothing');
select pg_temp.workout(16, d, 4, 30, 'aaaaaaaa-0000-0000-0000-000000000006') from generate_series(0, 2) d;
select is((select sum(points)::int from public.points_ledger where squad_id = 'aaaaaaaa-0000-0000-0000-000000000006' and source_type = 'challenge'), 240,
  'four of six done: 60 each');

-- A member who joined the squad mid-week is not counted and cannot take part.
select is((select roster || '/' || required from public.challenge_squad_status('squad-week-v1', 'aaaaaaaa-0000-0000-0000-000000000003', '2026-06-01')),
  '3/2', 'the Wednesday joiner is not in the roster (3 members, 2 needed)');
select throws_ok($$select pg_temp.join(24, 'squad-week-v1', '2026-06-01 00:00+00')$$, 'P0001', 'joined_squad_mid_week',
  'and cannot join this week''s squad challenge');
select pg_temp.join(n, 'squad-week-v1') from generate_series(21, 22) n;
select pg_temp.workout(n, d, 4, 30, 'aaaaaaaa-0000-0000-0000-000000000003') from generate_series(21, 22) n, generate_series(0, 2) d;
select is(pg_temp.cpoints(21) + pg_temp.cpoints(22), 120, 'two of the three starting members are enough');

-- Rules are locked once athletes have joined.
select throws_ok($$update public.challenges set config = '{}' where id = 'weekly-tiers-v1'$$, 'P0001', 'challenge_locked',
  'a joined challenge''s rules cannot be edited');

-- Access -----------------------------------------------------------------------------------------------------
create temp table four_workouts as
  select coalesce(sum(points), 0)::bigint as pts from public.points_ledger where squad_id = 'aaaaaaaa-0000-0000-0000-000000000004' and source_type = 'workout';
grant select on four_workouts to authenticated;
grant execute on function pg_temp.uid(int) to authenticated, anon;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(9))::text, true);
select is((select points from public.squad_standings(2026, 'world') where squad_id = 'aaaaaaaa-0000-0000-0000-000000000004'),
  (select pts + 180 from four_workouts), 'squad standings include squad challenge points like workout points');
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(1))::text, true);
select is((select count(*)::int from public.challenge_participants), 1, 'athletes see their own challenge entries');
select is((select count(*)::int from public.challenge_participants where user_id = pg_temp.uid(2)), 0, 'and not anyone else''s');
select is((select count(*)::int from public.challenge_awards), 3, 'and their own awards only');
select throws_ok($$update public.challenge_participants set tier = 'gold', accepted_workouts = 99$$, '42501', null, 'athletes cannot write their progress');
select throws_ok($$insert into public.challenge_participants (challenge_id, user_id, week_start, home_timezone, week_starts_at, week_ends_at, joined_at)
  values ('squad-week-v1', auth.uid(), '2026-06-01', 'UTC', '2026-06-01', '2026-06-08', '2026-05-01')$$, '42501', null,
  'athletes cannot backdate an entry');
select throws_ok($$insert into public.challenge_awards (participant_id, tier, tier_points, rule_version)
  select id, 'platinum', 999, 'v1' from public.challenge_participants$$, '42501', null, 'athletes cannot award themselves a tier');
select throws_ok($$select public.challenge_evaluate(auth.uid(), '2026-06-01')$$, '42501', null, 'athletes cannot run the evaluator');
select throws_ok($$select public.challenge_join_at(auth.uid(), 'weekly-tiers-v1', 'current', '2026-06-01')$$, '42501', null,
  'athletes cannot pick the join time');
select lives_ok($$select public.join_challenge('weekly-tiers-v1', 'next')$$, 'athletes join through join_challenge()');
select is((select string_agg(challenge_id || ':' || joined_next_week, ',') from public.my_challenges()),
  'weekly-tiers-v1:true,squad-week-v1:false', 'my_challenges lists this week''s challenges, including a join for next week');
select is((select join_blocked from public.my_challenges() where challenge_id = 'squad-week-v1'), 'not_in_squad',
  'and says why a challenge cannot be joined');
set local role anon;
select throws_ok($$select * from public.my_challenges()$$, '42501', null, 'anonymous visitors cannot read challenges');

-- The app's word is "counted workout" (DESIGN.md, Words); descriptions never say "accepted".
reset role;
select ok(not exists (select 1 from public.challenges where description ilike '%accepted%'),
  'challenge descriptions say counted workouts, never accepted');

select * from finish();
rollback;

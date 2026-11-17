begin;
select plan(44);

-- Scenario fixtures from docs/scoring-proposal.md §2 and §3. Workouts are built directly (as the
-- database owner) so each one has exactly the measurements the scenario describes; the engine must
-- reproduce the published numbers.

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'u' || n || '@example.com' from generate_series(1, 20) n;
update public.profile_private set home_timezone = 'UTC';

create function pg_temp.uid(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;

-- A finished workout for athlete n: starts at 2026-06-01 + start_min minutes, lasts `minutes` (all active).
create function pg_temp.workout(n int, activity text, minutes numeric, start_min int default 420, elapsed_min numeric default null)
returns uuid language plpgsql as $$
declare
  id uuid := gen_random_uuid();
  t0 timestamptz := timestamptz '2026-06-01 00:00:00+00' + make_interval(mins => start_min);
begin
  insert into public.workout_sessions (id, user_id, client_session_id, activity, state, started_at, ended_at, active_seconds, home_timezone, local_date)
  values (id, pg_temp.uid(n), gen_random_uuid(), activity, 'submitted', t0, t0 + make_interval(secs => coalesce(elapsed_min, minutes) * 60), minutes * 60, 'UTC', '2026-06-01');
  return id;
end;
$$;
create function pg_temp.gps(w uuid, km numeric, coverage numeric default 0.95, mocked int default 0) returns void language sql as $$
  insert into public.workout_metrics (session_id, metric, value, source, provenance) values
    (w, 'distance_m', km * 1000, 'gps', 'live'), (w, 'gps_coverage', coverage, 'gps', 'live'),
    (w, 'gps_points', 1000, 'gps', 'live'), (w, 'gps_excluded_m', 0, 'gps', 'live'), (w, 'gps_mocked_points', mocked, 'gps', 'live');
$$;
create function pg_temp.steps(w uuid, coverage numeric default 0.9) returns void language sql as $$
  insert into public.workout_metrics (session_id, metric, value, source, provenance) values
    (w, 'steps', 4000, 'pedometer', 'live'), (w, 'motion_coverage', coverage, 'pedometer', 'live');
$$;
-- A watch workout synced from Apple Health, with heart rate.
create function pg_temp.watch(w uuid, overlap numeric default 0.95, metres numeric default null) returns void language plpgsql as $$
begin
  insert into public.workout_evidence (session_id, provider, external_record_id, source_bundle_id, started_at, ended_at, overlap, distance_m, hr_samples, hr_minutes, hr_min, hr_avg, hr_max)
  select w, 'healthkit', w::text, 'com.apple.health', s.started_at, s.ended_at, overlap, metres, 500, 50, 95, 150, 178 from public.workout_sessions s where s.id = w;
  insert into public.workout_metrics (session_id, metric, value, source, provenance) values
    (w, 'platform_overlap', overlap, 'healthkit', 'synced'), (w, 'hr_coverage', 0.9, 'healthkit', 'synced');
end;
$$;
-- n sets logged live, evenly spaced through the workout.
create function pg_temp.sets(w uuid, n int, every_seconds numeric default null) returns void language sql as $$
  insert into public.strength_sets (session_id, client_set_id, exercise, reps, effective_at)
  select w, gen_random_uuid(), 'Squat', 8, s.started_at + make_interval(secs => 60 + i * coalesce(every_seconds, (s.active_seconds - 120.0) / (n - 1)))
  from public.workout_sessions s, generate_series(0, n - 1) i where s.id = w;
$$;
create function pg_temp.score(n int) returns void language sql as $$ select public.score_day(pg_temp.uid(n), '2026-06-01') $$;
create function pg_temp.result(w uuid) returns text language sql as $$
  select status || ' ' || base || '+' || verification || '+' || performance || '=' || total from public.workout_scores where session_id = w;
$$;
create function pg_temp.ledger(n int) returns int language sql as $$
  select coalesce(sum(points), 0)::int from public.points_ledger where user_id = pg_temp.uid(n);
$$;
create temp table w (k text primary key, id uuid);

-- Scoring is off until a rule version is switched on.
insert into w values ('off', pg_temp.workout(20, 'run', 30));
select pg_temp.gps((select id from w where k = 'off'), 5);
select pg_temp.score(20);
select is((select count(*)::int from public.workout_scores), 0, 'nothing is scored while scoring is switched off');
select public.set_scoring_active('v1', '2026-01-01');

-- §2 scenarios -------------------------------------------------------------------------------------
insert into w values ('1', pg_temp.workout(1, 'run', 30));
select pg_temp.gps((select id from w where k = '1'), 5), pg_temp.steps((select id from w where k = '1'));
select pg_temp.score(1);
select is(pg_temp.result((select id from w where k = '1')), 'accepted 170+25+19=214', '#1 phone-only 5 km run, 30 min');
select is((select categories from public.workout_scores where session_id = (select id from w where k = '1')), '{location,motion}'::text[], '#1 evidence: location + motion');

insert into w values ('1b', pg_temp.workout(2, 'run', 42));
select pg_temp.gps((select id from w where k = '1b'), 10), pg_temp.steps((select id from w where k = '1b'));
select pg_temp.score(2);
select is(pg_temp.result((select id from w where k = '1b')), 'accepted 170+25+37=232', '#1b fast runner, 10 km in 42 min');

insert into w values ('2', pg_temp.workout(3, 'run', 55));
select pg_temp.gps((select id from w where k = '2'), 10), pg_temp.steps((select id from w where k = '2')), pg_temp.watch((select id from w where k = '2'));
select pg_temp.score(3);
select is(pg_temp.result((select id from w where k = '2')), 'accepted 170+30+41=241', '#2 watch 10 km run, 55 min: four categories cap at 30');

insert into w values ('4', pg_temp.workout(4, 'strength', 50));
select pg_temp.sets((select id from w where k = '4'), 16);
select pg_temp.score(4);
select is(pg_temp.result((select id from w where k = '4')), 'accepted 170+15+33=218', '#4 phone-only strength, 50 min, 16 live sets');

insert into w values ('5', pg_temp.workout(5, 'strength', 60));
select pg_temp.sets((select id from w where k = '5'), 20), pg_temp.watch((select id from w where k = '5'));
select pg_temp.score(5);
select is(pg_temp.result((select id from w where k = '5')), 'accepted 170+30+45=245', '#5 watch strength, 60 min, 20 sets');

insert into w values ('6', pg_temp.workout(6, 'yoga', 45));
select pg_temp.score(6);
select is(pg_temp.result((select id from w where k = '6')), 'recorded 0+0+0=0', '#6 yoga with only a timer is saved and earns 0');

insert into w values ('8', pg_temp.workout(7, 'cycle', 60));
select pg_temp.gps((select id from w where k = '8'), 25), pg_temp.steps((select id from w where k = '8'));
select pg_temp.score(7);
select is(pg_temp.result((select id from w where k = '8')), 'accepted 170+25+42=237', '#8 phone-only 25 km ride, 60 min');

insert into w values ('9', pg_temp.workout(8, 'walk', 30));
select pg_temp.gps((select id from w where k = '9'), 3), pg_temp.steps((select id from w where k = '9'));
select pg_temp.score(8);
select is(pg_temp.result((select id from w where k = '9')), 'accepted 170+25+21=216', '#9 brisk walk 3 km, 30 min');

insert into w values ('11', pg_temp.workout(9, 'swim', 40));
select pg_temp.watch((select id from w where k = '11'), 0.95, 1500);
select pg_temp.score(9);
select is(pg_temp.result((select id from w where k = '11')), 'accepted 170+25+25=220', '#11 watch swim 1,500 m: heart rate + platform record (no watch motion yet), distance from the watch');

insert into w values ('13', pg_temp.workout(10, 'walk', 22));
select pg_temp.gps((select id from w where k = '13'), 1.8), pg_temp.steps((select id from w where k = '13'));
select pg_temp.score(10);
select is(pg_temp.result((select id from w where k = '13')), 'accepted 170+25+8=203', '#13 beginner 22 min walk');

insert into w values ('14', pg_temp.workout(11, 'run', 480));
select pg_temp.score(11);
select is(pg_temp.result((select id from w where k = '14')), 'recorded 0+0+0=0', '#14 abuse: 8-hour timer with no evidence earns 0');

insert into w values ('15', pg_temp.workout(12, 'run', 30));
select pg_temp.gps((select id from w where k = '15'), 19), pg_temp.steps((select id from w where k = '15'));
select pg_temp.score(12);
select is(pg_temp.result((select id from w where k = '15')), 'needs_review 0+0+0=0', '#15 abuse: a "run" at 38 km/h goes to review');
select is(pg_temp.ledger(12), 0, '#15 and earns nothing meanwhile');

-- Rules around the edges ---------------------------------------------------------------------------
insert into w values ('short', pg_temp.workout(13, 'run', 19));
select pg_temp.gps((select id from w where k = 'short'), 4), pg_temp.steps((select id from w where k = 'short'));
insert into w values ('hiit', pg_temp.workout(13, 'hiit', 16, 900));
select pg_temp.steps((select id from w where k = 'hiit'));
select pg_temp.score(13);
select is(pg_temp.result((select id from w where k = 'short')), 'recorded 0+0+0=0', 'under 20 active minutes is saved and earns 0');
select is(pg_temp.result((select id from w where k = 'hiit')), 'accepted 170+15+0=185', 'HIIT needs 15 minutes; the too-short run does not use up the first slot of the day');

insert into w values ('mock', pg_temp.workout(14, 'run', 30));
select pg_temp.gps((select id from w where k = 'mock'), 5, 0.95, 3);
select pg_temp.score(14);
select is(pg_temp.result((select id from w where k = 'mock')), 'recorded 0+0+0=0', 'simulated GPS fails the location category');

insert into w values ('weak', pg_temp.workout(15, 'run', 30));
select pg_temp.gps((select id from w where k = 'weak'), 5, 0.5), pg_temp.steps((select id from w where k = 'weak'));
select pg_temp.score(15);
select is(pg_temp.result((select id from w where k = 'weak')), 'accepted 170+15+8=193', 'weak GPS coverage: motion still counts, but the distance is not validated (no pace points)');

insert into w values ('bulk', pg_temp.workout(16, 'strength', 50));
select pg_temp.sets((select id from w where k = 'bulk'), 16, 5);
select pg_temp.score(16);
select is(pg_temp.result((select id from w where k = 'bulk')), 'recorded 0+0+0=0', 'sets typed in within a couple of minutes are not a live log');
select ok((select detail -> 'notes' ->> 0 from public.workout_scores where session_id = (select id from w where k = 'bulk')) like 'The set log did not count%',
  'the athlete is told why');

-- §3 daily rules -----------------------------------------------------------------------------------
-- A: run at 07:00 + strength at 18:00.
insert into w values ('a1', pg_temp.workout(17, 'run', 35, 420, 38)), ('a2', pg_temp.workout(17, 'strength', 45, 1080, 50));
select pg_temp.gps((select id from w where k = 'a1'), 6), pg_temp.steps((select id from w where k = 'a1')), pg_temp.sets((select id from w where k = 'a2'), 14);
select pg_temp.score(17);
select is(pg_temp.result((select id from w where k = 'a1')), 'accepted 170+25+24=219', 'day A: morning run at 100 %');
select is(pg_temp.result((select id from w where k = 'a2')), 'accepted 170+15+26=106', 'day A: evening strength at 50 %');
select is(pg_temp.ledger(17), 325, 'day A total 325');

-- B: one 60-minute run split into three 20-minute sessions, 2 minutes apart.
insert into w values ('b1', pg_temp.workout(18, 'run', 20, 420)), ('b2', pg_temp.workout(18, 'run', 20, 442)), ('b3', pg_temp.workout(18, 'run', 20, 464));
select pg_temp.gps(id, 3.5), pg_temp.steps(id) from w where k in ('b1', 'b2', 'b3');
select pg_temp.score(18);
select is(pg_temp.result((select id from w where k = 'b1')), 'accepted 170+25+43=238', 'day B: the split run is merged and scored once');
select is((select string_agg(status, ',') from public.workout_scores where session_id in (select id from w where k in ('b2', 'b3'))), 'merged,merged',
  'day B: the other parts are marked merged');
select is(pg_temp.ledger(18), 238, 'day B total 238');

-- C: four 25-minute walks spread through the day.
insert into w select 'c' || i, pg_temp.workout(19, 'walk', 25, 480 + i * 180) from generate_series(0, 3) i;
select pg_temp.gps(id, 2.2), pg_temp.steps(id) from w where k like 'c_';
select pg_temp.score(19);
select is((select string_agg(total::text, '+' order by k) from public.workout_scores s join w on w.id = s.session_id where k like 'c_'),
  '207+104+0+0', 'day C: 100 %, 50 %, then nothing');
select is(pg_temp.ledger(19), 311, 'day C total 311');

-- An empty session must not change what real workouts earn.
insert into auth.users (id, email) values (pg_temp.uid(21), 'u21@example.com'), (pg_temp.uid(22), 'u22@example.com');
insert into w values ('d1', pg_temp.workout(21, 'strength', 50, 420)), ('d2', pg_temp.workout(21, 'strength', 30, 500));
select pg_temp.sets((select id from w where k = 'd1'), 16);
select pg_temp.score(21);
select is(pg_temp.result((select id from w where k = 'd1')), 'accepted 170+15+33=218', 'a later session with no evidence does not wipe out a real workout');
select is(pg_temp.result((select id from w where k = 'd2')), 'recorded 0+0+0=0', 'and is simply saved with 0 points');
-- An empty session slipped between two halves of a run does not stop them merging.
insert into w values ('e1', pg_temp.workout(22, 'run', 30, 420)), ('e2', pg_temp.workout(22, 'run', 1, 451)), ('e3', pg_temp.workout(22, 'run', 30, 453));
select pg_temp.gps(id, 5), pg_temp.steps(id) from w where k in ('e1', 'e3');
select pg_temp.score(22);
select is(pg_temp.ledger(22), 236, 'an empty session between two halves does not turn one workout into two (one 60-minute, 10 km run)');

-- Ledger behaviour ---------------------------------------------------------------------------------
select pg_temp.score(1);
select is((select count(*)::int from public.points_ledger where user_id = pg_temp.uid(1)), 1, 'scoring again awards nothing twice');
select throws_ok(format($$insert into public.points_ledger (user_id, season, local_date, source_type, source_id, rule_version, kind, points, reason)
  values (%L, 2026, '2026-06-01', 'workout', %L, 'v1', 'award', 214, 'again')$$, pg_temp.uid(1), (select id from w where k = '1')),
  '23505', null, 'the ledger itself refuses a second award for the same workout');

-- Late evidence: the watch syncs after the run was scored. Verification rises through an adjustment row.
select pg_temp.watch((select id from w where k = '1'));
set constraints all immediate; -- what the end of the upload's transaction does
set constraints all deferred;
select is(pg_temp.result((select id from w where k = '1')), 'accepted 170+30+19=219', 'late Apple Health evidence re-scores the workout automatically');
select is((select string_agg(kind || ':' || points, ',' order by id) from public.points_ledger where user_id = pg_temp.uid(1)),
  'award:214,adjustment:5', 'the difference is a new ledger row; the award is never edited');
select is((select string_agg(distinct season || '/' || rule_version, ',') from public.points_ledger), '2026/v1',
  'every row names its season and rule version');

-- Access -------------------------------------------------------------------------------------------
grant execute on function pg_temp.uid(int) to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(1))::text, true);
select is((select count(*)::int from public.points_ledger), 2, 'athletes see their own ledger rows');
select is((select count(*)::int from public.workout_scores), 1, 'and their own scores only');
select throws_ok($$update public.workout_scores set total = 9999$$, '42501', null, 'athletes cannot edit a score');
select throws_ok($$insert into public.points_ledger (user_id, season, local_date, source_type, source_id, rule_version, kind, points, reason)
  values (auth.uid(), 2026, '2026-06-01', 'workout', gen_random_uuid(), 'v1', 'award', 250, 'gift')$$, '42501', null,
  'athletes cannot write points');
select throws_ok($$select public.score_day(auth.uid(), '2026-06-01')$$, '42501', null, 'athletes cannot run the scorer');
select throws_ok($$select public.set_scoring_active('v1', now())$$, '42501', null, 'athletes cannot switch scoring on');
select is((select count(*)::int from public.scoring_rule_versions), 1, 'the rules are readable');

select * from finish();
rollback;

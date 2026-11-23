begin;
select plan(10);

-- Workouts placed relative to the current week (UTC), so the test holds on any date.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'b1@example.com'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@example.com');
update public.profile_private set home_timezone = 'UTC', weekly_commitment = 2 where user_id = '00000000-0000-0000-0000-0000000000a1';
update public.profile_private set home_timezone = 'UTC', weekly_commitment = 1 where user_id = '00000000-0000-0000-0000-0000000000b1';
update public.profile_private set home_timezone = 'UTC', weekly_commitment = null where user_id = '00000000-0000-0000-0000-0000000000c1';

create function pg_temp.week(n int) returns date language sql as $$
  select (date_trunc('week', now() at time zone 'UTC')::date + n * 7)
$$;
-- A finished workout for `who` on day `d` (0 = Monday) of week offset `n`.
create function pg_temp.done(who uuid, n int, d int, state text default 'submitted') returns uuid language plpgsql as $$
declare id uuid := gen_random_uuid(); day date := pg_temp.week(n) + d;
begin
  insert into public.workout_sessions (id, user_id, client_session_id, activity, state, started_at, ended_at, active_seconds, home_timezone, local_date)
  values (id, who, gen_random_uuid(), 'run', state, day + time '07:00', day + time '07:30', 1800, 'UTC', day);
  return id;
end;
$$;

-- A (goal 2): met, met, missed, and nothing yet this week. One workout was discarded (never counts).
select pg_temp.done('00000000-0000-0000-0000-0000000000a1', -3, 0), pg_temp.done('00000000-0000-0000-0000-0000000000a1', -3, 2);
select pg_temp.done('00000000-0000-0000-0000-0000000000a1', -2, 1), pg_temp.done('00000000-0000-0000-0000-0000000000a1', -2, 3);
select pg_temp.done('00000000-0000-0000-0000-0000000000a1', -1, 0);
select pg_temp.done('00000000-0000-0000-0000-0000000000a1', -1, 4, 'abandoned');
-- B (goal 1): met the last two weeks; this week still open.
select pg_temp.done('00000000-0000-0000-0000-0000000000b1', -2, 0), pg_temp.done('00000000-0000-0000-0000-0000000000b1', -1, 0);

set local role anon;
select throws_ok($$select * from public.my_progress(2026)$$, '42501', null, 'visitors have no progress to read');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
select is((select goal_streak from public.my_progress(extract(year from now())::int)), 0, 'a missed finished week ends the streak');
select is((select best_streak from public.my_progress(extract(year from now())::int)), 2, 'the best run is kept');
select is((select all_time_workouts from public.my_progress(extract(year from now())::int)), 5, 'discarded workouts never count');
select is((select jsonb_array_length(weeks) from public.my_progress(extract(year from now())::int)), 12, 'twelve weeks of history');
select is((select (weeks -> 10 ->> 'days')::int from public.my_progress(extract(year from now())::int)), 1, 'last week shows its days');
select is((select weekly_goal from public.my_progress(extract(year from now())::int)), 2, 'the goal comes along');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
select is((select goal_streak from public.my_progress(extract(year from now())::int)), 2, 'an unfinished week never breaks the streak');
reset role;
select pg_temp.done('00000000-0000-0000-0000-0000000000b1', 0, 0);
set local role authenticated;
select is((select goal_streak from public.my_progress(extract(year from now())::int)), 3, 'reaching the goal this week adds it');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
select is((select goal_streak::text || '/' || all_time_workouts || '/' || season_points from public.my_progress(extract(year from now())::int)),
  '0/0/0', 'someone brand new gets zeros, not an error');

select * from finish();
rollback;

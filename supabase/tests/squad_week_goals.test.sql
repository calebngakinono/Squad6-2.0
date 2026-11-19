begin;
select plan(12);

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@example.com' from generate_series(1, 5) n;
update public.profile_private set home_timezone = 'UTC';
update public.profiles set display_name = 'Athlete ' || right(id::text, 1);
update public.profile_private set weekly_commitment = 4 where user_id = '00000000-0000-0000-0000-000000000001';
update public.profile_private set weekly_commitment = 3 where user_id = '00000000-0000-0000-0000-000000000002';

-- Squad A: athletes 1, 2, 3 (3 leaves). Squad B: athlete 4. Athlete 5 has no squad.
insert into public.squads (id, name, city, city_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'Squad A', 'x', 5419384), ('aaaaaaaa-0000-0000-0000-00000000000b', 'Squad B', 'x', 5419384);
insert into public.squad_members (squad_id, user_id, role, joined_at) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', 'captain', now() - interval '30 days'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000002', 'member', now() - interval '20 days'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000003', 'member', now() - interval '10 days'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000004', 'captain', now() - interval '30 days');
update public.squad_members set left_at = now(), left_reason = 'left' where user_id = '00000000-0000-0000-0000-000000000003';

-- A workout on a given day of this week (0 = Monday), in a given state.
create function pg_temp.workout(n int, weekday int, state text default 'submitted') returns void language sql as $$
  insert into public.workout_sessions (user_id, client_session_id, activity, state, started_at, ended_at, active_seconds, home_timezone, local_date)
  values (('00000000-0000-0000-0000-00000000000' || n)::uuid, gen_random_uuid(), 'run', state,
          now() - interval '2 hours', case when state = 'active' then null else now() - interval '1 hour' end,
          case when state = 'active' then null else 1800 end, 'UTC',
          date_trunc('week', now() at time zone 'UTC')::date + weekday);
$$;
select pg_temp.workout(1, 0);                    -- Monday
select pg_temp.workout(1, 0, 'accepted');        -- a second workout the same day: still one day
select pg_temp.workout(1, 1, 'needs_review');    -- waiting for review counts
select pg_temp.workout(1, 2, 'rejected');        -- rejected after review does not
select pg_temp.workout(1, 3, 'abandoned');       -- discarded does not
select pg_temp.workout(1, 4, 'active');          -- still running does not
select pg_temp.workout(1, -1);                   -- last Sunday: previous week
select pg_temp.workout(2, 0, 'accepted');
select pg_temp.workout(4, 0);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', true);

select is((select string_agg(display_name, ',') from public.squad_week_goals()), 'Athlete 1,Athlete 2',
  'my current squad, me first; someone who left is not shown');
select is((select weekly_goal || '/' || days_this_week from public.squad_week_goals() where is_me), '4/2',
  'my goal and days: two workouts on one day count once; waiting for review counts; rejected, discarded, running and last week do not');
select is((select weekly_goal || '/' || days_this_week from public.squad_week_goals() where not is_me), '3/1',
  'a teammate''s goal and days are visible to me');
select is((select week_start from public.squad_week_goals() where is_me), date_trunc('week', now() at time zone 'UTC')::date,
  'the week starts on Monday in my home time zone');

-- A changed goal applies to this week straight away.
reset role;
update public.profile_private set weekly_commitment = 2 where user_id = '00000000-0000-0000-0000-000000000002';
set local role authenticated;
select is((select weekly_goal from public.squad_week_goals() where not is_me), 2, 'a changed goal applies to the current week');

-- A member without a goal still shows, with days only.
reset role;
update public.profile_private set weekly_commitment = null where user_id = '00000000-0000-0000-0000-000000000002';
set local role authenticated;
select is((select coalesce(weekly_goal::text, 'none') || '/' || days_this_week from public.squad_week_goals() where not is_me), 'none/1',
  'a teammate without a goal shows days only');

select is((select count(*)::int from unnest((select proargnames from pg_proc where proname = 'squad_week_goals')) a
           where a ~ 'lat|lng|route|distance|heart|activity|session'), 0,
  'only counts are exposed: no workout details, location or health data');
select is((select count(*)::int from public.profile_private), 1, 'profile_private itself stays owner-only');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004"}', true);
select is((select string_agg(display_name || ':' || days_this_week, ',') from public.squad_week_goals()), 'Athlete 4:1',
  'another squad sees only its own members');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005"}', true);
select is((select count(*)::int from public.squad_week_goals()), 1, 'no squad: only my own row');
select is((select is_me from public.squad_week_goals()), true, 'and it is mine');

set local role anon;
select throws_ok($$select * from public.squad_week_goals()$$, '42501', null, 'anonymous visitors cannot read goals');

select * from finish();
rollback;

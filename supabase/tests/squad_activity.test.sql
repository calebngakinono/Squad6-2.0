begin;
select plan(10);

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@example.com' from generate_series(1, 5) n;
update public.profile_private set home_timezone = 'UTC';
update public.profiles set display_name = 'Athlete ' || right(id::text, 1);

-- Squad A: athletes 1, 2, 3 (3 later leaves). Squad B: athlete 4. Athlete 5 has no squad.
insert into public.squads (id, name, city, city_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'Squad A', 'x', 5419384), ('aaaaaaaa-0000-0000-0000-00000000000b', 'Squad B', 'x', 5419384);
insert into public.squad_members (squad_id, user_id, role, joined_at) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', 'captain', now() - interval '30 days'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000002', 'member', now() - interval '30 days'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000003', 'member', now() - interval '30 days'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000004', 'captain', now() - interval '30 days');

create function pg_temp.workout(n int, squad text, hours_ago int, state text default 'submitted') returns uuid language sql as $$
  insert into public.workout_sessions (user_id, client_session_id, activity, state, started_at, ended_at, active_seconds, home_timezone, local_date, squad_id)
  values (('00000000-0000-0000-0000-00000000000' || n)::uuid, gen_random_uuid(), 'run', state,
          now() - make_interval(hours => hours_ago + 1), case when state = 'active' then null else now() - make_interval(hours => hours_ago) end,
          case when state = 'active' then null else 1800 end, 'UTC', current_date, squad::uuid)
  returning id;
$$;
create temp table w as select pg_temp.workout(2, 'aaaaaaaa-0000-0000-0000-00000000000a', 3) as teammate;
select pg_temp.workout(1, 'aaaaaaaa-0000-0000-0000-00000000000a', 5);
select pg_temp.workout(2, 'aaaaaaaa-0000-0000-0000-00000000000a', 24 * 20);                          -- too old
select pg_temp.workout(2, null, 2);                                                                 -- before joining any squad
select pg_temp.workout(4, 'aaaaaaaa-0000-0000-0000-00000000000b', 1);                               -- other squad
select pg_temp.workout(3, 'aaaaaaaa-0000-0000-0000-00000000000a', 4);                               -- athlete 3, who leaves
select pg_temp.workout(1, 'aaaaaaaa-0000-0000-0000-00000000000a', 0, 'active');                    -- still running
insert into public.workout_scores (session_id, rule_version, status, base, verification, performance, factor, total)
select teammate, 'v1', 'accepted', 170, 25, 19, 1, 214 from w;
update public.squad_members set left_at = now(), left_reason = 'left' where user_id = '00000000-0000-0000-0000-000000000003';

grant select on w to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', true);

select is((select count(*)::int from public.squad_activity()), 2, 'my squad''s finished recent workouts, mine included');
select is((select display_name || '/' || points || '/' || status || '/' || active_minutes from public.squad_activity() where session_id = (select teammate from w)),
  'Athlete 2/214/accepted/30', 'a teammate''s workout shows name, points, outcome and minutes');
select is((select string_agg(is_me::text, ',' order by ended_at desc) from public.squad_activity()), 'false,true', 'newest first, my own rows marked');
select is((select count(*)::int from public.squad_activity() where display_name = 'Athlete 3'), 0, 'someone who left the squad is no longer shown');
select is((select count(*)::int from public.squad_activity(30)), 3, 'a longer window includes older workouts');
select is((select count(*)::int from public.workout_sessions), 2, 'the workouts table itself stays owner-only');
select is((select count(*)::int from unnest((select proargnames from pg_proc where proname = 'squad_activity')) a
           where a ~ 'lat|lng|route|distance|heart'), 0,
  'no location, distance or health data is exposed');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004"}', true);
select is((select string_agg(display_name, ',') from public.squad_activity()), 'Athlete 4', 'another squad sees only its own');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005"}', true);
select is((select count(*)::int from public.squad_activity()), 0, 'no squad, no activity');

set local role anon;
select throws_ok($$select * from public.squad_activity()$$, '42501', null, 'anonymous visitors cannot read activity');

select * from finish();
rollback;

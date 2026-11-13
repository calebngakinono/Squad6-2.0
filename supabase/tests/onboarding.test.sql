begin;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

select is((select count(*)::int from public.onboarding_flows where active), 1, 'exactly one active flow is readable');
select throws_ok($$insert into public.onboarding_flows (version, definition) values (99, '{}')$$, '42501', null,
  'clients cannot add flows');
select throws_ok($$update public.profile_private set onboarding_completed_at = now()$$, '42501', null,
  'clients cannot mark onboarding complete directly');

-- Progress
select lives_ok($$select public.save_onboarding_progress(1, 'goal', '{"display_name":"A","goal":"strength"}')$$,
  'progress can be saved');
select is((select onboarding_step from public.profile_private), 'goal', 'current step is saved');
select is((select onboarding_answers->>'goal' from public.profile_private), 'strength', 'answers are saved');
select throws_ok($$select public.save_onboarding_progress(42, 'x', '{}')$$, 'P0001', 'unknown_flow', 'unknown flow versions are refused');
select throws_ok($$select public.save_onboarding_progress(1, 'x', '[]')$$, 'P0001', 'invalid_answers', 'answers must be an object');
select throws_ok(format($$select public.save_onboarding_progress(1, 'x', %L)$$, json_build_object('big', repeat('x', 20000))),
  'P0001', 'invalid_answers', 'oversized answers are refused');

-- Completion validation
select throws_ok($$select public.complete_onboarding(1, '{}', '  ', 5419384, 'America/Denver', 3)$$, 'P0001', 'invalid_display_name',
  'a name is required');
select throws_ok($$select public.complete_onboarding(1, '{}', 'A', 5419384, 'America/Denver', 20)$$, 'P0001', 'invalid_weekly_commitment',
  'weekly commitment must be 1 to 14');
select throws_ok($$select public.complete_onboarding(1, '{}', 'A', 5419384, 'Mars/Base', 3)$$, '22023', null,
  'time zone is validated');

-- Completion
select lives_ok($$select public.complete_onboarding(1, '{"goal":"strength"}', ' Ana ', 5419384, 'America/Denver', 4)$$,
  'onboarding completes');
select is(
  (select p.display_name || '|' || p.city || '|' || pp.home_timezone || '|' || pp.weekly_commitment || '|' || (pp.onboarding_completed_at is not null)
   from public.profiles p join public.profile_private pp on pp.user_id = p.id),
  'Ana|Denver, Colorado|America/Denver|4|true',
  'profile fields are applied (the city label comes from the list)');

-- Someone else's data is untouched.
reset role;
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), null,
  'other users are not affected');

set local role anon;
select throws_ok($$select public.complete_onboarding(1, '{}', 'A', 5419384, 'UTC', 3)$$, '42501', null,
  'anonymous visitors cannot complete onboarding');

select * from finish();
rollback;

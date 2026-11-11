begin;
select plan(13);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

select is((select count(*)::int from public.profile_private), 1, 'a user sees only their own private row');

update public.profile_private set weekly_commitment = 4 where user_id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select weekly_commitment::int from public.profile_private),
  4,
  'a user can set their weekly commitment'
);

update public.profile_private set weekly_commitment = 9 where user_id = '00000000-0000-0000-0000-00000000000b';

select throws_ok(
  $$update public.profile_private set home_timezone = 'UTC' where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null,
  'home timezone cannot be written directly'
);

select throws_ok(
  $$insert into public.profile_private (user_id) values ('00000000-0000-0000-0000-00000000000a')$$,
  '42501', null,
  'clients cannot insert private rows'
);

-- Timezone function.
select lives_ok($$select public.set_home_timezone('America/Denver')$$, 'first timezone choice is allowed');
select is((select home_timezone from public.profile_private), 'America/Denver', 'timezone is saved');
select lives_ok($$select public.set_home_timezone('America/Denver')$$, 'setting the same timezone again is a no-op');
select throws_ok(
  $$select public.set_home_timezone('Mars/Olympus')$$,
  '22023', null,
  'unknown timezones are rejected'
);
select throws_ok(
  $$select public.set_home_timezone('Europe/Paris')$$,
  'P0001', 'home timezone can change once every 7 days',
  'timezone cannot change again within 7 days'
);

-- Simulate the last change being 8 days ago.
reset role;
update public.profile_private set home_timezone_changed_at = now() - interval '8 days'
where user_id = '00000000-0000-0000-0000-00000000000a';
set local role authenticated;
select lives_ok($$select public.set_home_timezone('Europe/Paris')$$, 'timezone can change after 7 days');

set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok('select count(*) from public.profile_private', '42501', null, 'anonymous visitors cannot read private rows');
select throws_ok($$select public.set_home_timezone('UTC')$$, '42501', null, 'anonymous visitors cannot set a timezone');

reset role;
select is(
  (select weekly_commitment from public.profile_private where user_id = '00000000-0000-0000-0000-00000000000b'),
  null,
  'a user cannot update someone else''s private row'
);

select * from finish();
rollback;

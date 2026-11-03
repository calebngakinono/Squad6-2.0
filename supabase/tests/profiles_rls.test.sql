begin;
select plan(6);

-- Two users; the signup trigger should create a profile for each.
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

select is(
  (select count(*)::int from public.profiles),
  2,
  'signup trigger creates one profile per user'
);

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

select is(
  (select count(*)::int from public.profiles),
  1,
  'a user sees only their own profile'
);

update public.profiles set display_name = 'A' where id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'A',
  'a user can update their own profile'
);

update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-00000000000b';
select throws_ok(
  $$insert into public.profiles (id) values ('00000000-0000-0000-0000-00000000000c')$$,
  '42501',
  null,
  'clients cannot insert profiles directly'
);

-- Act as anonymous visitor.
set local role anon;
select is(
  (select count(*)::int from public.profiles),
  0,
  'anonymous visitors see no profiles'
);

-- Back to superuser to inspect what really happened to user B.
reset role;
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  null,
  'a user cannot update someone else''s profile'
);

select * from finish();
rollback;

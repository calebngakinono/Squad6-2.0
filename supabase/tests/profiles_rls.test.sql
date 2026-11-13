begin;
select plan(10);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

select is((select count(*)::int from public.profiles), 2, 'signup trigger creates one profile per user');
select is((select count(*)::int from public.profile_private), 2, 'signup trigger creates one private row per user');
select hasnt_column('public', 'profiles', 'experience_level', 'Wrench experience_level column is gone');

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

select is((select count(*)::int from public.profiles), 2, 'signed-in users can read public profiles');

update public.profiles set display_name = 'A', city_id = 5419384 where id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select display_name || '/' || city from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'A/Denver, Colorado',
  'a user can update their own name and choose a city from the list'
);

update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-00000000000b';

select throws_ok(
  $$update public.profiles set created_at = now() where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null,
  'a user cannot update columns outside the allowed list'
);

select throws_ok(
  $$insert into public.profiles (id) values ('00000000-0000-0000-0000-00000000000c')$$,
  '42501', null,
  'clients cannot insert profiles directly'
);

select throws_ok(
  $$delete from public.profiles where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null,
  'clients cannot delete profiles'
);

-- Act as anonymous visitor.
set local role anon;
select throws_ok('select count(*) from public.profiles', '42501', null, 'anonymous visitors cannot read profiles');

reset role;
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  null,
  'a user cannot update someone else''s profile'
);

select * from finish();
rollback;

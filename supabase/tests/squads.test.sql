begin;
select plan(42);

-- Eight test athletes: u1 … u8.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@example.com' from generate_series(1, 8) n;

create function pg_temp.act_as(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || n)::text, true);
$$;
create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-00000000000' || n)::uuid;
$$;
grant execute on function pg_temp.act_as(int), pg_temp.uid(int) to authenticated, anon;

-- Scratch values shared between steps (written as the test user, read back later).
create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;
create function pg_temp.get(key text) returns text language sql as $$ select v from ctx where k = key $$;
grant execute on function pg_temp.get(text) to authenticated;

set local role authenticated;

-- Create ----------------------------------------------------------------------------------------
select pg_temp.act_as(1);
insert into ctx values ('squad', public.create_squad('  Dawn Patrol ', 'Denver', 'Early runs'));
select is((select name from public.squads where id = pg_temp.get('squad')::uuid), 'Dawn Patrol', 'squad name is trimmed');
select is((select role from public.squad_members where user_id = pg_temp.uid(1) and left_at is null), 'captain',
  'creator becomes captain');
insert into ctx values ('code', (select code from public.squad_invite_codes where squad_id = pg_temp.get('squad')::uuid));
select matches(pg_temp.get('code'), '^[A-HJ-NP-Z2-9]{8}$', 'members can read the invite code');
select throws_ok($$select public.create_squad('Second', 'Denver')$$, 'P0001', 'already_in_squad',
  'an athlete in a squad cannot create another');

-- Direct writes are refused ---------------------------------------------------------------------
select throws_ok(format($$insert into public.squad_members (squad_id, user_id) values (%L, %L)$$,
  pg_temp.get('squad'), pg_temp.uid(2)), '42501', null, 'clients cannot insert memberships directly');
select throws_ok($$update public.squad_members set role = 'member'$$, '42501', null, 'clients cannot change roles directly');
select throws_ok($$update public.squads set name = 'x'$$, '42501', null, 'clients cannot edit squads directly');
select throws_ok($$delete from public.squad_join_requests$$, '42501', null, 'clients cannot delete requests directly');

-- Outsider: preview and request -----------------------------------------------------------------
select pg_temp.act_as(2);
select is((select count(*)::int from public.squad_invite_codes), 0, 'non-members cannot read invite codes');
select is((select member_count from public.preview_squad(lower(pg_temp.get('code')))), 1,
  'preview accepts a lowercase code and shows the member count');
select is((select count(*)::int from public.squads), 1, 'signed-in users can see squad names');
select is((select count(*)::int from public.squad_members), 0, 'outsiders cannot read squad memberships');
select throws_ok($$select public.request_to_join('ZZZZZZZZ')$$, 'P0001', 'invalid_invite_code', 'unknown codes are rejected');

insert into ctx values ('req2', public.request_to_join(pg_temp.get('code')));
select is(public.request_to_join(pg_temp.get('code'))::text, pg_temp.get('req2'), 'asking twice returns the same request');
select is((select count(*)::int from public.squad_join_requests), 1, 'requester sees their own request');

-- u8 creates a second squad; u3 asks to join both.
select pg_temp.act_as(8);
insert into ctx values ('squad8', public.create_squad('Night Owls', 'Boulder'));
insert into ctx values ('code8', (select code from public.squad_invite_codes where squad_id = pg_temp.get('squad8')::uuid));

select pg_temp.act_as(3);
insert into ctx values ('req3', public.request_to_join(pg_temp.get('code')));
insert into ctx values ('req3b', public.request_to_join(pg_temp.get('code8')));
select pg_temp.act_as(4); insert into ctx values ('req4', public.request_to_join(pg_temp.get('code')));
select pg_temp.act_as(5); insert into ctx values ('req5', public.request_to_join(pg_temp.get('code')));
select pg_temp.act_as(6); insert into ctx values ('req6', public.request_to_join(pg_temp.get('code')));
select pg_temp.act_as(7); insert into ctx values ('req7', public.request_to_join(pg_temp.get('code')));

select is((select count(*)::int from public.squad_join_requests where status = 'pending'), 1,
  'u7 sees only their own pending request');

-- Deciding ----------------------------------------------------------------------------------------
select pg_temp.act_as(2);
select throws_ok(format($$select public.decide_join_request(%L, true)$$, pg_temp.get('req3')), 'P0001', 'request_not_found',
  'a non-captain cannot decide requests');

select pg_temp.act_as(1);
select is((select count(*)::int from public.squad_join_requests where status = 'pending'), 6, 'captain sees requests to their squad');
select lives_ok(format($$select public.decide_join_request(%L, true)$$, pg_temp.get('req3')), 'captain approves u3');
select is((select status from public.squad_join_requests where id = pg_temp.get('req3')::uuid), 'approved', 'request marked approved');
select throws_ok(format($$select public.decide_join_request(%L, true)$$, pg_temp.get('req3')), 'P0001', 'request_already_decided',
  'a request cannot be approved twice');

-- u8 tries to approve u3, who already joined u1's squad.
select pg_temp.act_as(8);
select throws_ok(format($$select public.decide_join_request(%L, true)$$, pg_temp.get('req3b')), 'P0001', 'request_already_decided',
  'joining one squad cancels the athlete''s other pending requests');

select pg_temp.act_as(1);
select lives_ok(format($$select public.decide_join_request(%L, false)$$, pg_temp.get('req2')), 'captain declines u2');
select public.decide_join_request(pg_temp.get('req4')::uuid, true);
select public.decide_join_request(pg_temp.get('req5')::uuid, true);
select public.decide_join_request(pg_temp.get('req6')::uuid, true);
select is((select count(*)::int from public.squad_members where squad_id = pg_temp.get('squad')::uuid and left_at is null), 5,
  'five members after approvals');

-- Fill to six with u2 (re-request after decline), then the seventh is refused.
select pg_temp.act_as(2);
insert into ctx values ('req2b', public.request_to_join(pg_temp.get('code')));
select pg_temp.act_as(1);
select public.decide_join_request(pg_temp.get('req2b')::uuid, true);
select is((select count(*)::int from public.squad_members where squad_id = pg_temp.get('squad')::uuid and left_at is null), 6,
  'squad reaches six');
select throws_ok(format($$select public.decide_join_request(%L, true)$$, pg_temp.get('req7')), 'P0001', 'squad_full',
  'a seventh member cannot be approved');

select pg_temp.act_as(8);
select public.leave_squad(); -- u8's squad is now empty and archived
select pg_temp.act_as(8);
select throws_ok(format($$select public.request_to_join(%L)$$, pg_temp.get('code')), 'P0001', 'squad_full',
  'requests to a full squad are refused');

-- Reading inside the squad ------------------------------------------------------------------------
select pg_temp.act_as(4);
select is((select count(*)::int from public.squad_members where left_at is null), 6, 'members can see their squadmates');
select is((select count(*)::int from public.squad_join_requests where user_id <> pg_temp.uid(4)), 0,
  'ordinary members cannot see other people''s join requests');
select throws_ok(format($$select public.remove_squad_member(%L)$$, pg_temp.uid(5)), 'P0001', 'member_not_found',
  'a member cannot remove another member');
select throws_ok('select public.regenerate_invite_code()', 'P0001', 'not_captain', 'a member cannot change the invite code');

-- Captain tools -----------------------------------------------------------------------------------
select pg_temp.act_as(1);
select throws_ok(format($$select public.request_to_join(%L)$$, pg_temp.get('code')), 'P0001', 'already_in_squad',
  'members cannot request to join');
select isnt(public.regenerate_invite_code(), pg_temp.get('code'), 'captain can regenerate the invite code');
select lives_ok(format($$select public.remove_squad_member(%L)$$, pg_temp.uid(5)), 'captain can remove a member');
select lives_ok(format($$select public.transfer_captaincy(%L)$$, pg_temp.uid(3)), 'captain can hand over the captaincy');
select is((select user_id from public.squad_members where squad_id = pg_temp.get('squad')::uuid and left_at is null and role = 'captain'),
  pg_temp.uid(3), 'u3 is now captain');

-- Leaving -----------------------------------------------------------------------------------------
-- Everything above ran in one transaction, so join times are equal. Give each member a distinct join
-- time in the order they joined (u1 first), as real separate sign-ups would have.
reset role;
update public.squad_members m set joined_at = now() - make_interval(mins => (100 - x.ord)::int)
from (select id, row_number() over (order by case user_id when pg_temp.uid(1) then 0 when pg_temp.uid(3) then 1
        when pg_temp.uid(4) then 2 when pg_temp.uid(6) then 3 else 4 end) as ord
      from public.squad_members where squad_id = pg_temp.get('squad')::uuid) x
where m.id = x.id;
update public.squad_members set left_at = greatest(left_at, joined_at) where left_at is not null;
set local role authenticated;

select pg_temp.act_as(3);
select public.leave_squad();
select pg_temp.act_as(1);
select is((select user_id from public.squad_members where squad_id = pg_temp.get('squad')::uuid and left_at is null and role = 'captain'),
  pg_temp.uid(1), 'when the captain leaves, the longest-standing member becomes captain');

select pg_temp.act_as(5);
select is((select count(*)::int from public.squad_members where user_id = pg_temp.uid(5)), 1,
  'a removed athlete still sees their own membership history');

reset role;
select is((select archived_at is not null from public.squads where id = pg_temp.get('squad8')::uuid), true,
  'a squad is archived when its last member leaves');
select is((select left_reason from public.squad_members where user_id = pg_temp.uid(5)), 'removed', 'removal is recorded');

-- Anonymous ---------------------------------------------------------------------------------------
set local role anon;
select throws_ok('select count(*) from public.squads', '42501', null, 'anonymous visitors cannot read squads');
select throws_ok($$select public.create_squad('x', 'y')$$, '42501', null, 'anonymous visitors cannot create squads');

select * from finish();
rollback;

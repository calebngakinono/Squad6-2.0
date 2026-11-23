begin;
select plan(26);

-- Squad with captain A and member B; C is in no squad; D left the squad.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a3', 'a3@example.com'),
  ('00000000-0000-0000-0000-0000000000b3', 'b3@example.com'),
  ('00000000-0000-0000-0000-0000000000c3', 'c3@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'd3@example.com');
insert into public.squads (id, name, city_id, created_by) values
  ('5c000000-0000-0000-0000-000000000001', 'Chat Test', 5506956, '00000000-0000-0000-0000-0000000000a3');
insert into public.squad_members (squad_id, user_id, role, joined_at, left_at, left_reason) values
  ('5c000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'captain', now() - interval '10 days', null, null),
  ('5c000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b3', 'member', now() - interval '10 days', null, null),
  ('5c000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d3', 'member', now() - interval '10 days', now() - interval '1 day', 'left');

create function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
$$;
create temp table ids (k text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
insert into ids select 'hello', id from public.send_squad_message('  Morning run done.  ');
select is((select body from public.squad_messages where id = (select id from ids where k = 'hello')), 'Morning run done.', 'a member can post; spaces trimmed');
select throws_ok($$select public.send_squad_message('   ')$$, 'P0001', 'message_empty', 'empty messages are refused');
select throws_ok($$select public.send_squad_message(repeat('x', 2001))$$, 'P0001', 'message_too_long', 'at most 2,000 characters');
select throws_ok($$insert into public.squad_messages (squad_id, user_id, body) values ('5c000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'x')$$,
  '42501', null, 'nobody writes to the table directly');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select is((select count(*)::int from public.squad_messages), 1, 'teammates read the chat');
select is(public.my_squad_chat_unread(), 1, 'one unread message for B');
select public.mark_squad_chat_read();
select is(public.my_squad_chat_unread(), 0, 'reading clears it');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select is((select count(*)::int from public.squad_messages), 0, 'outsiders read nothing');
select throws_ok($$select public.send_squad_message('hi')$$, 'P0001', 'not_in_squad', 'and cannot post');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
select is((select count(*)::int from public.squad_messages), 0, 'leaving the squad ends access to its chat');

-- Reactions
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select is(public.toggle_squad_reaction((select id from ids where k = 'hello'), 'fire'), true, 'a reaction goes on');
select is((select count(*)::int from public.squad_message_reactions), 1, 'and teammates see it');
select is(public.toggle_squad_reaction((select id from ids where k = 'hello'), 'fire'), false, 'the same tap takes it back');
select throws_ok($$select public.toggle_squad_reaction((select id from ids where k = 'hello'), 'skull')$$, 'P0001', 'invalid_reaction', 'only the fixed reactions');

-- Deleting
insert into ids select 'b-msg', id from public.send_squad_message('Mine');
select throws_ok($$select public.delete_squad_message((select id from ids where k = 'hello'))$$, 'P0001', 'not_allowed', 'members cannot delete others'' messages');
select public.delete_squad_message((select id from ids where k = 'b-msg'));
select is((select body is null and deleted_at is not null from public.squad_messages where id = (select id from ids where k = 'b-msg')), true, 'the sender can delete their own; the words are gone');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select lives_ok($$select public.delete_squad_message((select id from ids where k = 'hello'))$$, 'the captain can remove any message in the squad');

-- Reports: once per person
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
insert into ids select 'b2', id from public.send_squad_message('Report me');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select public.report_squad_message((select id from ids where k = 'b2'), 'Spam');
select lives_ok($$select public.report_squad_message((select id from ids where k = 'b2'), 'Again')$$, 'reporting twice is harmless');
select is((select count(*)::int from public.squad_message_reports), 1, 'and counts once');

-- Workout shares: the server's numbers, never the sender's
reset role;
select public.set_scoring_active('v1', '2026-01-01');
insert into public.workout_sessions (id, user_id, client_session_id, activity, state, started_at, ended_at, active_seconds, home_timezone, local_date) values
  ('5c000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a3', gen_random_uuid(), 'yoga', 'submitted',
   '2026-06-01 07:00+00', '2026-06-01 07:45+00', 2700, 'UTC', '2026-06-01');
select public.score_day('00000000-0000-0000-0000-0000000000a3', '2026-06-01');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
insert into ids select 'share', id from public.share_workout_to_squad('5c000000-0000-0000-0000-0000000000f1', 'Long flow today');
select is((select workout ->> 'outcome' || '/' || (workout ->> 'points') || '/' || (workout ->> 'active_minutes') || '/' || body
           from public.squad_messages where id = (select id from ids where k = 'share')),
  'unverified/0/45/Long flow today', 'a timer-only workout is shared as unverified, 0 points');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select throws_ok($$select public.share_workout_to_squad('5c000000-0000-0000-0000-0000000000f1')$$, 'P0001', 'workout_not_found', 'nobody can share someone else''s workout');

-- Rate limit: 20 a minute
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
reset role;
insert into public.squad_messages (squad_id, user_id, body)
select '5c000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'flood ' || n from generate_series(1, 20) n;
set local role authenticated;
select throws_ok($$select public.send_squad_message('one more')$$, 'P0001', 'slow_down', 'at most 20 messages a minute');

-- Unread counts only what others said after I last read
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select public.mark_squad_chat_read();
select is(public.my_squad_chat_unread(), 0, 'nothing new');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select is(public.my_squad_chat_unread(), 0, 'no squad, no unread');
select throws_ok($$select public.mark_squad_chat_read()$$, 'P0001', 'not_in_squad', 'no squad, nothing to mark');

reset role;
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'squad_messages'), 'messages are published to realtime');

select * from finish();
rollback;

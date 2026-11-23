-- Squad chat (Caleb, 2026-11-22): every squad has a private group chat. At launch: text, reactions,
-- shared workout summaries, delete and report, and an unread count. Photos, short videos and push
-- notifications come after launch.
--
-- Access: only current members read a squad's chat; leaving or being removed ends access at once.
-- Every write goes through a function below, so nobody can post as someone else, into another squad,
-- or put made-up points into a workout share (the server builds the share from the score).
-- Deleting an account deletes that person's messages and reactions (on delete cascade).

-- 1. Tables -------------------------------------------------------------------------------------

create table public.squad_messages (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'workout')),
  -- Text, or the sender's own words with a shared workout. Null once deleted.
  body text check (char_length(body) between 1 and 2000),
  -- A shared workout: the session and a snapshot the server took when it was shared.
  workout_session_id uuid references public.workout_sessions (id) on delete set null,
  workout jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  check (kind <> 'workout' or workout is not null),
  check (deleted_at is not null or kind = 'workout' or body is not null)
);
create index squad_messages_squad_time on public.squad_messages (squad_id, created_at desc);
create index squad_messages_user_time on public.squad_messages (user_id, created_at desc);

comment on table public.squad_messages is 'Squad chat. Members read; written only through the chat functions.';

create table public.squad_message_reactions (
  message_id uuid not null references public.squad_messages (id) on delete cascade,
  -- Copied from the message so realtime can filter reactions by squad.
  squad_id uuid not null references public.squads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('like', 'strong', 'fire', 'clap')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, reaction)
);

create table public.squad_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.squad_messages (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (message_id, reporter_id)
);

comment on table public.squad_message_reports is 'Reported chat messages, for an operator to review in the SQL editor.';

create table public.squad_chat_reads (
  squad_id uuid not null references public.squads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (squad_id, user_id)
);

-- 2. Access ---------------------------------------------------------------------------------------

-- Whether someone is a current member of a squad.
create function public.is_current_member(target_squad uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.squad_members m
                 where m.squad_id = target_squad and m.user_id = target_user and m.left_at is null);
$$;

alter table public.squad_messages enable row level security;
alter table public.squad_message_reactions enable row level security;
alter table public.squad_message_reports enable row level security;
alter table public.squad_chat_reads enable row level security;

create policy "squad_messages: current members can read"
  on public.squad_messages for select to authenticated
  using (public.is_current_member(squad_id, (select auth.uid())));
create policy "squad_message_reactions: current members can read"
  on public.squad_message_reactions for select to authenticated
  using (public.is_current_member(squad_id, (select auth.uid())));
create policy "squad_message_reports: reporter can read own"
  on public.squad_message_reports for select to authenticated
  using (reporter_id = (select auth.uid()));
create policy "squad_chat_reads: owner can read"
  on public.squad_chat_reads for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.squad_messages, public.squad_message_reactions, public.squad_message_reports, public.squad_chat_reads
  from anon, authenticated;
grant select on public.squad_messages, public.squad_message_reactions, public.squad_message_reports, public.squad_chat_reads
  to authenticated;
grant execute on function public.is_current_member(uuid, uuid) to authenticated;

-- 3. Writing ------------------------------------------------------------------------------------

-- The caller's current squad, or not_in_squad.
create function public.chat_my_squad()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  squad uuid;
begin
  select m.squad_id into squad from public.squad_members m
    where m.user_id = public.require_user_uid() and m.left_at is null;
  if squad is null then
    raise exception 'not_in_squad' using errcode = 'P0001';
  end if;
  return squad;
end;
$$;

-- At most 20 messages a minute per person (spam guard). Errors (P0001): slow_down.
create function public.chat_rate_limit(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.squad_messages
      where user_id = target_user and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'slow_down' using errcode = 'P0001';
  end if;
end;
$$;

-- Errors (P0001): not_in_squad, message_empty, message_too_long, slow_down.
create function public.send_squad_message(body text)
returns public.squad_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  squad uuid := public.chat_my_squad();
  clean text := btrim(coalesce(send_squad_message.body, ''));
  result public.squad_messages;
begin
  if clean = '' then
    raise exception 'message_empty' using errcode = 'P0001';
  end if;
  if char_length(clean) > 2000 then
    raise exception 'message_too_long' using errcode = 'P0001';
  end if;
  perform public.chat_rate_limit(uid);
  insert into public.squad_messages (squad_id, user_id, kind, body) values (squad, uid, 'text', clean)
  returning * into result;
  return result;
end;
$$;

-- Share one of my finished workouts. The summary comes from the server's own records: activity,
-- active minutes, and points only when the scorer accepted it. Nothing typed by the sender changes it.
-- Errors (P0001): not_in_squad, workout_not_found, workout_not_finished, message_too_long, slow_down.
create function public.share_workout_to_squad(target uuid, body text default null)
returns public.squad_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  squad uuid := public.chat_my_squad();
  s public.workout_sessions;
  sc public.workout_scores;
  clean text := nullif(btrim(coalesce(share_workout_to_squad.body, '')), '');
  result public.squad_messages;
begin
  select * into s from public.workout_sessions where id = target and user_id = uid;
  if s.id is null then
    raise exception 'workout_not_found' using errcode = 'P0001';
  end if;
  if s.state not in ('submitted', 'accepted', 'needs_review') then
    raise exception 'workout_not_finished' using errcode = 'P0001';
  end if;
  if char_length(clean) > 2000 then
    raise exception 'message_too_long' using errcode = 'P0001';
  end if;
  perform public.chat_rate_limit(uid);
  select * into sc from public.workout_scores where session_id = s.id;

  insert into public.squad_messages (squad_id, user_id, kind, body, workout_session_id, workout)
  values (squad, uid, 'workout', clean, s.id, jsonb_build_object(
    'activity', s.activity,
    'active_minutes', round(coalesce(s.active_seconds, 0) / 60.0),
    'local_date', s.local_date,
    -- counted (points from the scorer), unverified (timer only), or other (in review, not scored, ...)
    'outcome', case when sc.status = 'accepted' then 'counted'
                    when sc.status = 'recorded' and cardinality(sc.categories) = 0 then 'unverified'
                    else 'other' end,
    'points', case when sc.status = 'accepted' then sc.total else 0 end))
  returning * into result;
  return result;
end;
$$;

-- The sender, or the squad's captain, can delete a message. Its words are removed; a placeholder stays.
-- Errors (P0001): message_not_found, not_allowed.
create function public.delete_squad_message(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  msg public.squad_messages;
begin
  select * into msg from public.squad_messages where id = target;
  if msg.id is null or not public.is_current_member(msg.squad_id, uid) then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;
  if msg.user_id <> uid and not exists (select 1 from public.squad_members m
      where m.squad_id = msg.squad_id and m.user_id = uid and m.left_at is null and m.role = 'captain') then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  update public.squad_messages
    set body = null, workout = case when kind = 'workout' then '{}'::jsonb end, workout_session_id = null,
        deleted_at = coalesce(deleted_at, now()), deleted_by = coalesce(deleted_by, uid)
    where id = target;
  delete from public.squad_message_reactions where message_id = target;
end;
$$;

-- Adds a reaction, or takes it back if it was already there. Returns whether it is now on.
-- Errors (P0001): message_not_found, invalid_reaction.
create function public.toggle_squad_reaction(target uuid, reaction text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  msg public.squad_messages;
begin
  if toggle_squad_reaction.reaction not in ('like', 'strong', 'fire', 'clap') then
    raise exception 'invalid_reaction' using errcode = 'P0001';
  end if;
  select * into msg from public.squad_messages where id = target and deleted_at is null;
  if msg.id is null or not public.is_current_member(msg.squad_id, uid) then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;
  delete from public.squad_message_reactions r
    where r.message_id = target and r.user_id = uid and r.reaction = toggle_squad_reaction.reaction;
  if found then
    return false;
  end if;
  insert into public.squad_message_reactions (message_id, squad_id, user_id, reaction)
  values (target, msg.squad_id, uid, toggle_squad_reaction.reaction);
  return true;
end;
$$;

-- Report a message to the operators (once per person per message). Errors (P0001): message_not_found.
create function public.report_squad_message(target uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  msg public.squad_messages;
begin
  select * into msg from public.squad_messages where id = target;
  if msg.id is null or not public.is_current_member(msg.squad_id, uid) then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;
  insert into public.squad_message_reports (message_id, reporter_id, reason)
  values (target, uid, left(nullif(btrim(coalesce(report_squad_message.reason, '')), ''), 500))
  on conflict (message_id, reporter_id) do nothing;
end;
$$;

-- I have read my squad's chat up to now.
create function public.mark_squad_chat_read()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  squad uuid := public.chat_my_squad();
begin
  insert into public.squad_chat_reads (squad_id, user_id, last_read_at) values (squad, uid, now())
  on conflict (squad_id, user_id) do update set last_read_at = now();
end;
$$;

-- Messages from others in my squad since I last read it (0 without a squad). Read-only.
create function public.my_squad_chat_unread()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select count(*)::int
    from public.squad_members m
    join public.squad_messages msg on msg.squad_id = m.squad_id
    left join public.squad_chat_reads r on r.squad_id = m.squad_id and r.user_id = m.user_id
    where m.user_id = public.require_user_uid() and m.left_at is null
      and msg.user_id <> m.user_id and msg.deleted_at is null
      -- Only what was said since I joined or last read.
      and msg.created_at > greatest(m.joined_at, coalesce(r.last_read_at, m.joined_at))
  ), 0);
$$;

-- Operators: reported messages not yet looked at (SQL editor, like workouts_awaiting_review).
create view public.chat_reports_awaiting_review with (security_invoker = true) as
  select r.id as report_id, r.created_at as reported_at, r.reason, m.id as message_id, m.squad_id, m.user_id as author_id,
         m.body, m.kind, m.deleted_at
  from public.squad_message_reports r
  join public.squad_messages m on m.id = r.message_id
  where r.resolved_at is null
  order by r.created_at;
revoke all on public.chat_reports_awaiting_review from anon, authenticated;

revoke all on function
  public.chat_my_squad(), public.chat_rate_limit(uuid), public.send_squad_message(text),
  public.share_workout_to_squad(uuid, text), public.delete_squad_message(uuid), public.toggle_squad_reaction(uuid, text),
  public.report_squad_message(uuid, text), public.mark_squad_chat_read(), public.my_squad_chat_unread()
from public, anon, authenticated;
grant execute on function
  public.send_squad_message(text), public.share_workout_to_squad(uuid, text), public.delete_squad_message(uuid),
  public.toggle_squad_reaction(uuid, text), public.report_squad_message(uuid, text), public.mark_squad_chat_read(),
  public.my_squad_chat_unread()
to authenticated;

-- 4. Realtime -------------------------------------------------------------------------------------
-- New messages and reactions are pushed to subscribed members (Realtime applies the read policies above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.squad_messages, public.squad_message_reactions;
  end if;
end;
$$;

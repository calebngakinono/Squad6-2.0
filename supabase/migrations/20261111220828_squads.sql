-- Squads: up to six athletes, one squad per athlete at a time.
-- All writes go through the functions below; clients can only read, and only what RLS allows.
-- Membership history is kept (left_at), because squad standings weight members by days in the squad.

-- 1. Tables -----------------------------------------------------------------------------------

create table public.squads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  city text not null check (char_length(btrim(city)) between 1 and 80),
  description text check (char_length(description) <= 280),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

comment on table public.squads is 'Squad name and city are public to signed-in users (leaderboards).';

create table public.squad_members (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('captain', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  left_reason text check (left_reason in ('left', 'removed')),
  check ((left_at is null) = (left_reason is null)),
  check (left_at is null or left_at >= joined_at)
);

comment on table public.squad_members is
  'Membership history. Active rows have left_at null. Never deleted: standings use days in squad.';

-- One active squad per athlete, and one active captain per squad.
create unique index squad_members_one_active_squad on public.squad_members (user_id) where left_at is null;
create unique index squad_members_one_captain on public.squad_members (squad_id)
  where left_at is null and role = 'captain';
create index squad_members_squad_active on public.squad_members (squad_id) where left_at is null;

create table public.squad_invite_codes (
  squad_id uuid primary key references public.squads (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_at timestamptz not null default now()
);

comment on table public.squad_invite_codes is 'Readable by active squad members only.';

create table public.squad_join_requests (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  check ((status = 'pending') = (decided_at is null))
);

create unique index squad_join_requests_one_pending on public.squad_join_requests (squad_id, user_id)
  where status = 'pending';
create index squad_join_requests_user_pending on public.squad_join_requests (user_id) where status = 'pending';

-- 2. Helpers (security definer so RLS policies can use them without recursion) -----------------

create function public.is_squad_member(target_squad uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.squad_members
    where squad_id = target_squad and user_id = (select auth.uid()) and left_at is null
  );
$$;

create function public.is_squad_captain(target_squad uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.squad_members
    where squad_id = target_squad and user_id = (select auth.uid()) and left_at is null and role = 'captain'
  );
$$;

-- 8 characters without look-alikes (no I, O, 0, 1): 32^8, about 1.1 trillion codes.
create function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  result text := '';
begin
  for i in 0..7 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

create function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  return uid;
end;
$$;

-- 3. Row-level security: reads only -----------------------------------------------------------

alter table public.squads enable row level security;
alter table public.squad_members enable row level security;
alter table public.squad_invite_codes enable row level security;
alter table public.squad_join_requests enable row level security;

create policy "squads: signed-in users can read"
  on public.squads for select to authenticated using (true);

create policy "squad_members: squadmates and self can read"
  on public.squad_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_squad_member(squad_id));

create policy "squad_invite_codes: members can read"
  on public.squad_invite_codes for select to authenticated
  using (public.is_squad_member(squad_id));

create policy "squad_join_requests: requester and captain can read"
  on public.squad_join_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_squad_captain(squad_id));

revoke all on public.squads, public.squad_members, public.squad_invite_codes, public.squad_join_requests
  from anon;
revoke insert, update, delete, truncate on
  public.squads, public.squad_members, public.squad_invite_codes, public.squad_join_requests
  from authenticated;

-- 4. Actions ----------------------------------------------------------------------------------
-- Errors use a stable machine-readable message (SQLSTATE P0001) that the app maps to friendly text.

create function public.create_squad(squad_name text, squad_city text, squad_description text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  new_id uuid;
begin
  -- Serialize this athlete's squad actions.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  if exists (select 1 from public.squad_members where user_id = uid and left_at is null) then
    raise exception 'already_in_squad' using errcode = 'P0001';
  end if;
  if (select count(*) from public.squads
      where created_by = uid and created_at > now() - interval '30 days') >= 3 then
    raise exception 'squad_creation_limit' using errcode = 'P0001';
  end if;

  insert into public.squads (name, city, description, created_by)
  values (btrim(squad_name), btrim(squad_city), nullif(btrim(squad_description), ''), uid)
  returning id into new_id;

  insert into public.squad_members (squad_id, user_id, role) values (new_id, uid, 'captain');
  insert into public.squad_invite_codes (squad_id, code) values (new_id, public.generate_invite_code());

  -- Being in a squad ends any other pending requests.
  update public.squad_join_requests set status = 'cancelled', decided_at = now()
  where user_id = uid and status = 'pending';

  return new_id;
end;
$$;

-- What someone holding an invite code may see before asking to join.
create function public.preview_squad(invite_code text)
returns table (squad_id uuid, name text, city text, member_count int, is_full boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.city, count(m.id)::int, count(m.id) >= 6
  from public.squad_invite_codes c
  join public.squads s on s.id = c.squad_id and s.archived_at is null
  left join public.squad_members m on m.squad_id = s.id and m.left_at is null
  where (select auth.uid()) is not null and c.code = upper(btrim(invite_code))
  group by s.id;
$$;

create function public.request_to_join(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  target uuid;
  request_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  select s.id into target
  from public.squad_invite_codes c join public.squads s on s.id = c.squad_id
  where c.code = upper(btrim(invite_code)) and s.archived_at is null;
  if target is null then
    raise exception 'invalid_invite_code' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.squad_members where user_id = uid and left_at is null) then
    raise exception 'already_in_squad' using errcode = 'P0001';
  end if;
  if (select count(*) from public.squad_members where squad_id = target and left_at is null) >= 6 then
    raise exception 'squad_full' using errcode = 'P0001';
  end if;
  select id into request_id from public.squad_join_requests
  where squad_id = target and user_id = uid and status = 'pending';
  if request_id is not null then
    return request_id; -- Asking twice is fine.
  end if;
  if (select count(*) from public.squad_join_requests where user_id = uid and status = 'pending') >= 3 then
    raise exception 'too_many_pending_requests' using errcode = 'P0001';
  end if;

  insert into public.squad_join_requests (squad_id, user_id) values (target, uid) returning id into request_id;
  return request_id;
end;
$$;

create function public.cancel_join_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  update public.squad_join_requests set status = 'cancelled', decided_at = now()
  where id = request_id and user_id = uid and status = 'pending';
  if not found then
    raise exception 'request_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create function public.decide_join_request(request_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  req public.squad_join_requests;
begin
  select * into req from public.squad_join_requests where id = request_id for update;
  if req.id is null or not public.is_squad_captain(req.squad_id) then
    raise exception 'request_not_found' using errcode = 'P0001';
  end if;
  if req.status <> 'pending' then
    raise exception 'request_already_decided' using errcode = 'P0001';
  end if;

  if not approve then
    update public.squad_join_requests set status = 'declined', decided_at = now(), decided_by = uid
    where id = request_id;
    return;
  end if;

  -- Lock the squad so two approvals at the same moment cannot make a seventh member,
  -- and lock the requester so they cannot be approved into two squads at once.
  perform 1 from public.squads where id = req.squad_id for update;
  perform pg_advisory_xact_lock(hashtextextended(req.user_id::text, 0));

  if exists (select 1 from public.squad_members where user_id = req.user_id and left_at is null) then
    raise exception 'requester_in_other_squad' using errcode = 'P0001';
  end if;
  if (select count(*) from public.squad_members where squad_id = req.squad_id and left_at is null) >= 6 then
    raise exception 'squad_full' using errcode = 'P0001';
  end if;

  insert into public.squad_members (squad_id, user_id, role) values (req.squad_id, req.user_id, 'member');
  update public.squad_join_requests set status = 'approved', decided_at = now(), decided_by = uid
  where id = request_id;
  update public.squad_join_requests set status = 'cancelled', decided_at = now()
  where user_id = req.user_id and status = 'pending';
end;
$$;

-- Ends a membership. Hands the captaincy to the longest-standing member, or archives an empty squad.
-- Internal: called only by the functions below.
create function public.end_membership(member_user uuid, reason text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  m public.squad_members;
  successor uuid;
begin
  select * into m from public.squad_members where user_id = member_user and left_at is null for update;
  if m.id is null then
    raise exception 'not_in_squad' using errcode = 'P0001';
  end if;
  perform 1 from public.squads where id = m.squad_id for update;

  update public.squad_members set left_at = now(), left_reason = reason where id = m.id;

  if m.role = 'captain' then
    select id into successor from public.squad_members
    where squad_id = m.squad_id and left_at is null
    order by joined_at, id limit 1;
    if successor is not null then
      update public.squad_members set role = 'captain' where id = successor;
    else
      update public.squads set archived_at = now() where id = m.squad_id;
      update public.squad_join_requests set status = 'expired', decided_at = now()
      where squad_id = m.squad_id and status = 'pending';
    end if;
  end if;
end;
$$;

create function public.leave_squad()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.end_membership(public.require_user(), 'left');
end;
$$;

create function public.remove_squad_member(member_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  target_squad uuid;
begin
  select squad_id into target_squad from public.squad_members where user_id = member_user and left_at is null;
  if target_squad is null or member_user = uid or not public.is_squad_captain(target_squad) then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  perform public.end_membership(member_user, 'removed');
end;
$$;

create function public.transfer_captaincy(new_captain uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  target_squad uuid;
begin
  select squad_id into target_squad from public.squad_members
  where user_id = uid and left_at is null and role = 'captain';
  if target_squad is null
     or new_captain = uid
     or not exists (select 1 from public.squad_members
                    where squad_id = target_squad and user_id = new_captain and left_at is null) then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  perform 1 from public.squads where id = target_squad for update;
  -- Demote first: only one active captain may exist at a time (unique index).
  update public.squad_members set role = 'member'
  where squad_id = target_squad and user_id = uid and left_at is null;
  update public.squad_members set role = 'captain'
  where squad_id = target_squad and user_id = new_captain and left_at is null;
end;
$$;

create function public.regenerate_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  target_squad uuid;
  new_code text := public.generate_invite_code();
begin
  select squad_id into target_squad from public.squad_members
  where user_id = uid and left_at is null and role = 'captain';
  if target_squad is null then
    raise exception 'not_captain' using errcode = 'P0001';
  end if;
  update public.squad_invite_codes set code = new_code, created_at = now() where squad_id = target_squad;
  return new_code;
end;
$$;

-- 5. Who may call what -------------------------------------------------------------------------
-- Postgres lets everyone execute new functions by default; take that away, then grant the app API.

revoke all on function
  public.generate_invite_code(),
  public.require_user(),
  public.end_membership(uuid, text),
  public.is_squad_member(uuid),
  public.is_squad_captain(uuid),
  public.create_squad(text, text, text),
  public.preview_squad(text),
  public.request_to_join(text),
  public.cancel_join_request(uuid),
  public.decide_join_request(uuid, boolean),
  public.leave_squad(),
  public.remove_squad_member(uuid),
  public.transfer_captaincy(uuid),
  public.regenerate_invite_code()
from public, anon, authenticated;

grant execute on function
  public.is_squad_member(uuid),
  public.is_squad_captain(uuid),
  public.create_squad(text, text, text),
  public.preview_squad(text),
  public.request_to_join(text),
  public.cancel_join_request(uuid),
  public.decide_join_request(uuid, boolean),
  public.leave_squad(),
  public.remove_squad_member(uuid),
  public.transfer_captaincy(uuid),
  public.regenerate_invite_code()
to authenticated;

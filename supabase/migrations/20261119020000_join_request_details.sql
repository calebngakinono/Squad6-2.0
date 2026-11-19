-- Join requests: a short note from the person asking, and what the captain sees before deciding
-- (Caleb, 2026-11-18). Nobody joins a squad without the captain's approval (unchanged); the captain now
-- gets enough to decide well: the person's note, name, city, how long they have been on Squad Six, and
-- their accepted workouts and points this season. Never their precise location: city at most.
--
-- The captain can't message the person back (option a). Chat is deferred (docs/mvp-plan.md).

-- 1. The note -------------------------------------------------------------------------------------

alter table public.squad_join_requests
  add column note text check (note is null or char_length(note) between 1 and 280);

comment on column public.squad_join_requests.note is
  'Optional message from the person asking to join, shown to the captain. Up to 280 characters.';

-- request_to_join gains an optional note. The old one-argument function is replaced, not overloaded:
-- with both, request_to_join('CODE') would be ambiguous. Apps that send only the code keep working.
drop function public.request_to_join(text);

create function public.request_to_join(invite_code text, note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  target uuid;
  request_id uuid;
  clean_note text := nullif(btrim(note), '');
begin
  if char_length(clean_note) > 280 then
    raise exception 'note_too_long' using errcode = 'P0001';
  end if;

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
  select r.id into request_id from public.squad_join_requests r
  where r.squad_id = target and r.user_id = uid and r.status = 'pending';
  if request_id is not null then
    -- Asking twice is fine; a new note replaces the old one.
    if clean_note is not null then
      update public.squad_join_requests set note = clean_note where id = request_id;
    end if;
    return request_id;
  end if;
  if (select count(*) from public.squad_join_requests where user_id = uid and status = 'pending') >= 3 then
    raise exception 'too_many_pending_requests' using errcode = 'P0001';
  end if;

  insert into public.squad_join_requests (squad_id, user_id, note) values (target, uid, clean_note)
  returning id into request_id;
  return request_id;
end;
$$;

-- 2. What the captain sees --------------------------------------------------------------------------
-- Pending requests to a squad, with the details the captain decides on. Only the squad's captain gets
-- rows; anyone else gets none. Season figures come from the server's records (accepted workouts and the
-- points ledger) for the person's current season (their home-time-zone year).
create function public.squad_join_request_details(target_squad uuid)
returns table (
  request_id uuid,
  user_id uuid,
  display_name text,
  note text,
  requested_at timestamptz,
  city text,
  country text,
  member_since timestamptz,
  season int,
  season_workouts int,
  season_points bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with req as (
    select r.id, r.user_id, r.note, r.created_at,
           extract(year from now() at time zone coalesce(pp.home_timezone, 'UTC'))::int as yr
    from public.squad_join_requests r
    left join public.profile_private pp on pp.user_id = r.user_id
    where r.squad_id = target_squad and r.status = 'pending' and public.is_squad_captain(target_squad)
  )
  select req.id, req.user_id, p.display_name, req.note, req.created_at, c.name, c.country, p.created_at, req.yr,
         (select count(*)::int
            from public.workout_sessions w join public.workout_scores ws on ws.session_id = w.id
           where w.user_id = req.user_id and ws.status = 'accepted' and extract(year from w.local_date)::int = req.yr),
         (select coalesce(sum(l.points), 0)::bigint
            from public.points_ledger l where l.user_id = req.user_id and l.season = req.yr)
  from req
  join public.profiles p on p.id = req.user_id
  left join public.cities c on c.id = p.city_id
  order by req.created_at
$$;

-- 3. Permissions -----------------------------------------------------------------------------------

revoke all on function
  public.request_to_join(text, text),
  public.squad_join_request_details(uuid)
from public, anon, authenticated;

grant execute on function
  public.request_to_join(text, text),
  public.squad_join_request_details(uuid)
to authenticated;

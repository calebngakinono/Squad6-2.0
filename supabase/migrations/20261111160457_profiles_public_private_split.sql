-- Squad Six schema foundation: split profiles into a public part (what teammates see) and a
-- private part (owner only), and remove the leftover Wrench AI column.
--
-- destructive-ok: drops profiles.experience_level and its enum type (Wrench AI onboarding answer,
-- test data only). Approved by Caleb on 2026-11-11.

-- 1. Remove the Wrench column.
alter table public.profiles drop column experience_level;
drop type public.experience_level;

-- 2. Public profile: readable by any signed-in user, so squadmates and leaderboards can show names.
--    Only city is shown, never precise location.
alter table public.profiles
  add column city text check (char_length(city) between 1 and 80);

comment on table public.profiles is
  'Public profile, visible to signed-in users. Never put private or precise-location data here.';

drop policy "profiles: owner can read" on public.profiles;
create policy "profiles: signed-in users can read"
  on public.profiles for select
  to authenticated
  using (true);

-- Column-level privileges: the owner may change only these columns. New columns (e.g. future
-- verification or role fields) are not writable by clients unless granted here.
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, city) on public.profiles to authenticated;

-- 3. Private profile: owner only.
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- IANA name (e.g. 'America/Denver'). Decides the season year and the scoring "day".
  -- Changed only through set_home_timezone(), which limits how often it can change.
  home_timezone text,
  home_timezone_changed_at timestamptz,
  -- Personal goal shown to the athlete. Not scored (weekly-goal points were dropped 2026-11-10).
  weekly_commitment smallint check (weekly_commitment between 1 and 14),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profile_private is 'Owner-only settings and personal data.';

alter table public.profile_private enable row level security;

create policy "profile_private: owner can read"
  on public.profile_private for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "profile_private: owner can update"
  on public.profile_private for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.profile_private from anon;
revoke insert, update, delete on public.profile_private from authenticated;
grant update (weekly_commitment, onboarding_completed_at) on public.profile_private to authenticated;

create trigger profile_private_set_updated_at
  before update on public.profile_private
  for each row execute function public.set_updated_at();

-- Existing users get a private row.
insert into public.profile_private (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- 4. New users get both rows.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.profile_private (user_id) values (new.id);
  return new;
end;
$$;

-- 5. Home timezone. Validated against the database's timezone list. After the first choice it can
--    change at most once every 7 days, so nobody can shift their scoring "day" back and forth.
create function public.set_home_timezone(tz text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  current_tz text;
  changed_at timestamptz;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = tz) then
    raise exception 'unknown timezone: %', tz using errcode = '22023';
  end if;

  select home_timezone, home_timezone_changed_at into current_tz, changed_at
  from public.profile_private where user_id = uid
  for update;

  if current_tz is not distinct from tz then
    return;
  end if;
  if current_tz is not null and changed_at > now() - interval '7 days' then
    raise exception 'home timezone can change once every 7 days' using errcode = 'P0001';
  end if;

  update public.profile_private
  set home_timezone = tz, home_timezone_changed_at = now()
  where user_id = uid;
end;
$$;

revoke all on function public.set_home_timezone(text) from public, anon;
grant execute on function public.set_home_timezone(text) to authenticated;

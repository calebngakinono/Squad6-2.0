-- Home cities per season, for squads and for people (Caleb, 2026-11-22).
--
-- Squads: a squad competes in one home city per season. It is set at creation (squads.city_id, the
-- founding city, never changes). The captain can schedule a different home city, which takes effect on
-- January 1 of the next season; until then the plan can be changed or cancelled, so there is still one
-- city per season. Members keep their own cities and a captain moving changes nothing. Past seasons keep
-- the city they were played in.
--
-- People: the individual board ranks someone in their own city. To stop a mid-season move to a weaker
-- city, a change of city takes effect on the board next season once the person already has points this
-- season; before that it applies straight away (new people are unaffected).
--
-- Points never move: the ledger keeps the squad each point was earned in. Country and world boards
-- follow the same city.

-- 1. Squad home cities ---------------------------------------------------------------------------

create table public.squad_home_cities (
  squad_id uuid not null references public.squads (id) on delete cascade,
  from_season int not null check (from_season between 2026 and 2200),
  city_id bigint not null references public.cities (id),
  set_by uuid references auth.users (id) on delete set null,
  set_at timestamptz not null default now(),
  primary key (squad_id, from_season)
);

comment on table public.squad_home_cities is
  'Home city changes per squad, effective from a season. Before the first change the founding city (squads.city_id) applies.';

alter table public.squad_home_cities enable row level security;
create policy "squad_home_cities: members can read"
  on public.squad_home_cities for select to authenticated
  using (exists (select 1 from public.squad_members m
                 where m.squad_id = squad_home_cities.squad_id and m.user_id = (select auth.uid()) and m.left_at is null));
revoke all on public.squad_home_cities from anon, authenticated;
grant select on public.squad_home_cities to authenticated;

-- The squad's home city for a season.
create function public.squad_city_for(target uuid, season int)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select h.city_id from public.squad_home_cities h
      where h.squad_id = target and h.from_season <= squad_city_for.season
      order by h.from_season desc limit 1),
    (select s.city_id from public.squads s where s.id = target));
$$;

-- The current season in a person's home time zone.
create function public.season_now(target_user uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select extract(year from now() at time zone coalesce(
    (select pp.home_timezone from public.profile_private pp where pp.user_id = target_user), 'UTC'))::int;
$$;

-- Captain only: the squad's home city from next season. Choosing the current home city cancels a plan.
-- Errors (P0001): not_captain, city_required.
create function public.set_squad_home_city(new_city bigint)
returns table (city text, from_season int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  squad uuid;
  next_season int;
begin
  select m.squad_id into squad from public.squad_members m
    where m.user_id = uid and m.left_at is null and m.role = 'captain';
  if squad is null then
    raise exception 'not_captain' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.cities c where c.id = new_city) then
    raise exception 'city_required' using errcode = 'P0001';
  end if;
  next_season := public.season_now(uid) + 1;

  if new_city = public.squad_city_for(squad, next_season - 1) then
    delete from public.squad_home_cities h where h.squad_id = squad and h.from_season = next_season;
    return;
  end if;
  insert into public.squad_home_cities (squad_id, from_season, city_id, set_by)
  values (squad, next_season, new_city, uid)
  -- By constraint name: the function's own output column is also called from_season.
  on conflict on constraint squad_home_cities_pkey do update set city_id = excluded.city_id, set_by = excluded.set_by, set_at = now();
  return query select public.city_label(new_city), next_season;
end;
$$;

-- My squad's home city now, and a planned change if there is one (members only; empty without a squad).
create function public.my_squad_home_city()
returns table (city text, city_id bigint, next_city text, next_city_id bigint, next_from_season int)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select m.squad_id, public.season_now(m.user_id) as season
    from public.squad_members m
    where m.user_id = public.require_user_uid() and m.left_at is null
  ),
  planned as (
    select h.* from public.squad_home_cities h, mine
    where h.squad_id = mine.squad_id and h.from_season > mine.season
    order by h.from_season limit 1
  )
  select public.city_label(public.squad_city_for(mine.squad_id, mine.season)),
         public.squad_city_for(mine.squad_id, mine.season),
         (select public.city_label(p.city_id) from planned p),
         (select p.city_id from planned p),
         (select p.from_season from planned p)
  from mine;
$$;

-- 2. People's competitive city -------------------------------------------------------------------

create table public.athlete_home_cities (
  user_id uuid not null references auth.users (id) on delete cascade,
  from_season int not null check (from_season between 2026 and 2200),
  city_id bigint not null references public.cities (id),
  set_at timestamptz not null default now(),
  primary key (user_id, from_season)
);

comment on table public.athlete_home_cities is
  'The city a person competes in on the individual board, per season. Written only by the profiles trigger.';

alter table public.athlete_home_cities enable row level security;
create policy "athlete_home_cities: owner can read"
  on public.athlete_home_cities for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.athlete_home_cities from anon, authenticated;
grant select on public.athlete_home_cities to authenticated;

-- Everyone who already has a city competes there from the first season.
insert into public.athlete_home_cities (user_id, from_season, city_id)
select p.id, 2026, p.city_id from public.profiles p where p.city_id is not null
on conflict do nothing;

-- A new city counts this season until the person has points this season; after that, from next season.
create function public.record_athlete_home_city()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur_season int;
  effective int;
begin
  if new.city_id is null or (tg_op = 'UPDATE' and new.city_id is not distinct from old.city_id) then
    return null;
  end if;
  cur_season := public.season_now(new.id);
  effective := case when exists (select 1 from public.points_ledger l where l.user_id = new.id and l.season = cur_season)
                    then cur_season + 1 else cur_season end;
  insert into public.athlete_home_cities (user_id, from_season, city_id)
  values (new.id, effective, new.city_id)
  on conflict (user_id, from_season) do update set city_id = excluded.city_id, set_at = now();
  return null;
end;
$$;

create trigger profiles_athlete_home_city after insert or update of city_id on public.profiles
  for each row execute function public.record_athlete_home_city();

create function public.athlete_city_for(target uuid, season int)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select h.city_id from public.athlete_home_cities h
      where h.user_id = target and h.from_season <= athlete_city_for.season
      order by h.from_season desc limit 1),
    (select p.city_id from public.profiles p where p.id = target));
$$;

-- 3. Boards use the season's city ----------------------------------------------------------------

create or replace function public.my_standings_place()
returns table (city_id bigint, city text, country_code text, country text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.country_code, c.country
  from public.cities c
  where c.id = coalesce(
    (select public.squad_city_for(m.squad_id, public.season_now(m.user_id)) from public.squad_members m
      where m.user_id = public.require_user_uid() and m.left_at is null),
    (select p.city_id from public.profiles p where p.id = public.require_user_uid()));
$$;

create or replace function public.my_athlete_place()
returns table (city_id bigint, city text, country_code text, country text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.country_code, c.country
  from public.cities c
  where c.id = public.athlete_city_for(public.require_user_uid(), public.season_now(public.require_user_uid()));
$$;

create or replace function public.squad_standings(season int, scope text default 'world', max_rows int default 50)
returns table (rank bigint, squad_id uuid, name text, city text, country text, points bigint, members int, is_ranked boolean, is_mine boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  place record;
  mine uuid;
  top int := least(greatest(coalesce(max_rows, 50), 1), 100);
begin
  if scope is null or scope not in ('city', 'country', 'world') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;
  select m.squad_id into mine from public.squad_members m where m.user_id = uid and m.left_at is null;
  -- Centred on my squad's home city for that season, or my own city without a squad.
  select c.id as city_id, c.country_code into place from public.cities c
    where c.id = coalesce(public.squad_city_for(mine, squad_standings.season),
                          (select p.city_id from public.profiles p where p.id = uid));
  if scope <> 'world' and place.city_id is null then
    return;
  end if;

  return query
  with totals as (
    select l.squad_id, sum(l.points)::bigint as points
    from public.points_ledger l
    where l.season = squad_standings.season and l.squad_id is not null
    group by l.squad_id
  ),
  sizes as (
    select m.squad_id, count(*)::int as members
    from public.squad_members m
    where m.left_at is null
    group by m.squad_id
  ),
  homes as (
    select s.id, s.name, public.squad_city_for(s.id, squad_standings.season) as city_id
    from public.squads s
    where exists (select 1 from totals t where t.squad_id = s.id) or s.id = mine
  ),
  in_area as (
    select h.id, h.name, public.city_label(h.city_id) as city, c.country, coalesce(t.points, 0) as points, coalesce(z.members, 0) as members
    from homes h
    left join public.cities c on c.id = h.city_id
    left join totals t on t.squad_id = h.id
    left join sizes z on z.squad_id = h.id
    where (coalesce(t.points, 0) > 0 or h.id = mine)
      and (scope = 'world'
           or (scope = 'city' and h.city_id = place.city_id)
           or (scope = 'country' and c.country_code = place.country_code))
  ),
  ranked as (
    select case when a.members >= 4 then rank() over (partition by a.members >= 4 order by a.points desc) end as rank, a.*
    from in_area a
  )
  select r.rank, r.id, r.name, r.city, r.country, r.points, r.members, r.members >= 4, r.id is not distinct from mine
  from ranked r
  where r.rank <= top or r.rank is null or r.id is not distinct from mine
  order by r.rank nulls last, r.points desc, r.name
  limit 200;
end;
$$;

create or replace function public.athlete_standings(season int, scope text default 'world', max_rows int default 50)
returns table (rank bigint, display_name text, city text, points bigint, is_me boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  place record;
  top int := least(greatest(coalesce(max_rows, 50), 1), 100);
begin
  if scope is null or scope not in ('city', 'country', 'world') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;
  select c.id as city_id, c.country_code into place from public.cities c
    where c.id = public.athlete_city_for(uid, athlete_standings.season);
  if scope <> 'world' and place.city_id is null then
    return;
  end if;

  return query
  with totals as (
    select l.user_id, sum(l.points)::bigint as points
    from public.points_ledger l
    where l.season = athlete_standings.season
    group by l.user_id
  ),
  people as (
    select p.id, p.display_name, public.athlete_city_for(p.id, athlete_standings.season) as city_id, coalesce(t.points, 0) as points
    from public.profiles p
    left join totals t on t.user_id = p.id
    where coalesce(t.points, 0) > 0 or p.id = uid
  ),
  in_area as (
    select a.id, a.display_name, public.city_label(a.city_id) as city, a.points
    from people a
    left join public.cities c on c.id = a.city_id
    where scope = 'world'
       or (scope = 'city' and a.city_id = place.city_id)
       or (scope = 'country' and c.country_code = place.country_code)
  ),
  ranked as (
    select case when a.points > 0 then rank() over (partition by a.points > 0 order by a.points desc) end as r, a.*
    from in_area a
  )
  select r.r, r.display_name, r.city, r.points, r.id = uid
  from ranked r
  where r.r <= top or r.id = uid
  order by r.r nulls last, r.display_name
  limit top + 1;
end;
$$;

revoke all on function
  public.squad_city_for(uuid, int), public.season_now(uuid), public.set_squad_home_city(bigint),
  public.my_squad_home_city(), public.record_athlete_home_city(), public.athlete_city_for(uuid, int)
from public, anon, authenticated;
grant execute on function public.set_squad_home_city(bigint), public.my_squad_home_city() to authenticated;

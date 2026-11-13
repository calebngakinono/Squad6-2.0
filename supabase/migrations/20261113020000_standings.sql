-- Scoring engine, part 3: season standings.
--
-- Decided by Caleb on 2026-11-12 (replaces the "average per member" rule in docs/scoring-proposal.md):
--   * Leaderboards rank SQUADS only: within a city, within a country, and worldwide.
--     There is no ranking of individual athletes. Each athlete sees their own season total.
--   * A squad's score is the plain total of the points its members earned while in it. Every member's
--     every workout counts; nothing is averaged, weighted or added for empty seats.
--   * A squad is ranked once it has 4 current members. Before that it earns points normally and is
--     listed without a rank; when the fourth member joins, everything already earned counts.
--
-- Standings are always derived from the points ledger; no total is stored anywhere a user could edit.
-- The ledger itself stays owner-only: these functions expose only squad totals, names and cities.
-- A season is a calendar year (the athlete's home-timezone year, locked on each ledger row).
--
-- Computed on request for now. If this gets slow, materialize per season (docs/architecture.md).

-- The signed-in athlete's own points for a season.
create function public.my_season_points(season int)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(l.points), 0)::bigint
  from public.points_ledger l
  where l.user_id = public.require_user_uid() and l.season = my_season_points.season;
$$;

-- Where the caller's standings are centred: their squad's city, or their own city if they have no squad.
create function public.my_standings_place()
returns table (city_id bigint, city text, country_code text, country text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.country_code, c.country
  from public.cities c
  where c.id = coalesce(
    (select s.city_id from public.squad_members m join public.squads s on s.id = m.squad_id
      where m.user_id = public.require_user_uid() and m.left_at is null),
    (select p.city_id from public.profiles p where p.id = public.require_user_uid()));
$$;

-- Squads ranked by season points, within the caller's city, their country, or the world.
--
--   points  = everything members earned while in the squad (squad_id is locked on each ledger row, so
--             points stay with the squad where they were earned, whoever joins or leaves later)
--   ranked  = the squad has at least 4 current members
--
-- Unranked squads in the same area are listed after the ranked ones, with their points and no rank.
-- The caller's own squad is always included when it is in the area.
create function public.squad_standings(season int, scope text default 'world', max_rows int default 50)
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
  select * into place from public.my_standings_place();
  if scope <> 'world' and place.city_id is null then
    return; -- the caller has not chosen a city yet
  end if;
  select m.squad_id into mine from public.squad_members m where m.user_id = uid and m.left_at is null;

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
  in_area as (
    select s.id, s.name, s.city, c.country, coalesce(t.points, 0) as points, coalesce(z.members, 0) as members
    from public.squads s
    left join public.cities c on c.id = s.city_id
    left join totals t on t.squad_id = s.id
    left join sizes z on z.squad_id = s.id
    where (coalesce(t.points, 0) > 0 or s.id = mine)
      and (scope = 'world'
           or (scope = 'city' and s.city_id = place.city_id)
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

revoke all on function
  public.my_season_points(int),
  public.my_standings_place(),
  public.squad_standings(int, text, int)
from public, anon, authenticated;

grant execute on function
  public.my_season_points(int),
  public.my_standings_place(),
  public.squad_standings(int, text, int)
to authenticated;

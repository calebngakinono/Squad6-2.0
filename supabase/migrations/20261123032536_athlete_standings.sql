-- Individual rankings (Caleb, 2026-11-22): athletes ranked by their own season points in their city,
-- their country, or the world, alongside the squad rankings. This reverses the 2026-11-12 "squads only"
-- decision (docs/scoring-proposal.md §8, decision 12).
--
-- Fair by construction:
--   points = the athlete's season total in the points ledger (workouts and challenges). Unverified
--            workouts are scored 0, so they never count; nothing here depends on Pro.
--   place  = the athlete's own city (profiles.city_id). A squad ranks by its own home city instead.
--   shown  = display name, city label and points. No user ids, nothing more precise than the city.
--   listed = athletes with points this season; the caller always sees their own row, even at 0.

-- Where the caller's individual standings are centred: their own city (never their squad's).
create function public.my_athlete_place()
returns table (city_id bigint, city text, country_code text, country text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.country_code, c.country
  from public.profiles p
  join public.cities c on c.id = p.city_id
  where p.id = public.require_user_uid();
$$;

create function public.athlete_standings(season int, scope text default 'world', max_rows int default 50)
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
  select * into place from public.my_athlete_place();
  if scope <> 'world' and place.city_id is null then
    return; -- the caller has not chosen a city yet
  end if;

  return query
  with totals as (
    select l.user_id, sum(l.points)::bigint as points
    from public.points_ledger l
    where l.season = athlete_standings.season
    group by l.user_id
  ),
  in_area as (
    select p.id, p.display_name, p.city, coalesce(t.points, 0) as points
    from public.profiles p
    left join public.cities c on c.id = p.city_id
    left join totals t on t.user_id = p.id
    where (coalesce(t.points, 0) > 0 or p.id = uid)
      and (scope = 'world'
           or (scope = 'city' and p.city_id = place.city_id)
           or (scope = 'country' and c.country_code = place.country_code))
  ),
  ranked as (
    -- Only athletes with points hold a rank; the caller at 0 is listed without one.
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

revoke all on function public.my_athlete_place(), public.athlete_standings(int, text, int) from public, anon, authenticated;
grant execute on function public.my_athlete_place(), public.athlete_standings(int, text, int) to authenticated;

-- "Hide me from rankings" (Caleb, 2026-11-23): a private setting that keeps someone off the People board for
-- everyone else. Their points are unchanged and still count for their squad; the squad board is not affected.
-- They still see their own row (unranked), and a hidden person never shifts anyone else's rank.

alter table public.profile_private add column hide_from_rankings boolean not null default false;
comment on column public.profile_private.hide_from_rankings is 'Leave me off the individual (People) rankings. Owner-editable.';
grant update (hide_from_rankings) on public.profile_private to authenticated;

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
    -- Hidden people are left out for everyone else; I always see my own row.
    select p.id, p.display_name, public.athlete_city_for(p.id, athlete_standings.season) as city_id, coalesce(t.points, 0) as points,
           coalesce(pp.hide_from_rankings, false) as hidden
    from public.profiles p
    left join public.profile_private pp on pp.user_id = p.id
    left join totals t on t.user_id = p.id
    where (coalesce(t.points, 0) > 0 and not coalesce(pp.hide_from_rankings, false)) or p.id = uid
  ),
  in_area as (
    select a.id, a.display_name, public.city_label(a.city_id) as city, a.points, a.hidden
    from people a
    left join public.cities c on c.id = a.city_id
    where scope = 'world'
       or (scope = 'city' and a.city_id = place.city_id)
       or (scope = 'country' and c.country_code = place.country_code)
  ),
  ranked as (
    -- Only visible athletes with points hold a rank, so a hidden person never shifts anyone's place.
    select case when a.points > 0 and not a.hidden then rank() over (partition by a.points > 0 and not a.hidden order by a.points desc) end as r, a.*
    from in_area a
  )
  select r.r, r.display_name, r.city, r.points, r.id = uid
  from ranked r
  where r.r <= top or r.id = uid
  order by r.r nulls last, r.display_name
  limit top + 1;
end;
$$;

-- Scoring engine, part 3: season standings (athletes and squads), overall or within a city.
--
-- Standings are always derived from the points ledger; no total is stored anywhere a user could edit.
-- The ledger itself stays owner-only: these functions expose only totals, names and cities.
-- A season is a calendar year (the athlete's home-timezone year, locked on each ledger row).
--
-- Computed on request for now. If this gets slow, materialize per season (docs/architecture.md).

-- The part of a season that has happened so far, in whole days (UTC calendar).
create function public.season_window(season int, out first_day date, out last_day date, out days_elapsed int)
language sql
stable
set search_path = ''
as $$
  select make_date(season, 1, 1),
         least((now() at time zone 'utc')::date, make_date(season, 12, 31)),
         greatest(0, least((now() at time zone 'utc')::date, make_date(season, 12, 31)) - make_date(season, 1, 1) + 1);
$$;

-- Athletes ranked by season points. Always includes the caller's own row, even outside the top.
create function public.athlete_standings(season int, in_city text default null, max_rows int default 50)
returns table (rank bigint, user_id uuid, display_name text, city text, points bigint, is_me boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
begin
  return query
  with totals as (
    select l.user_id, sum(l.points)::bigint as points
    from public.points_ledger l
    where l.season = athlete_standings.season and l.user_id is not null
    group by l.user_id
    having sum(l.points) > 0
  ),
  ranked as (
    select rank() over (order by t.points desc) as rank, t.user_id, p.display_name, p.city, t.points
    from totals t
    join public.profiles p on p.id = t.user_id
    where in_city is null or lower(btrim(p.city)) = lower(btrim(in_city))
  )
  select r.rank, r.user_id, r.display_name, r.city, r.points, r.user_id = uid
  from ranked r
  where r.rank <= least(greatest(coalesce(max_rows, 50), 1), 100) or r.user_id = uid
  order by r.rank, r.display_name nulls last, r.user_id;
end;
$$;

-- Squads ranked by average points per member (docs/scoring-proposal.md §5, approved):
--
--   score = points members earned while in the squad ÷ member-seasons
--   member-seasons = sum of each member's days in the squad this season ÷ days elapsed in the season
--
-- Seats are counted by time in the squad, so removing a low scorer does not erase the days they were
-- there. Points stay with the squad where they were earned (squad_id is locked on each ledger row).
-- A squad needs at least 3 current members to be ranked; smaller squads are listed without a rank.
-- Always includes the caller's own squad.
create function public.squad_standings(season int, in_city text default null, max_rows int default 50)
returns table (rank bigint, squad_id uuid, name text, city text, score bigint, points bigint, members int, is_ranked boolean, is_mine boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  w record;
  mine uuid;
begin
  select * into w from public.season_window(season);
  if w.days_elapsed = 0 then
    return; -- a season that has not started
  end if;
  select m.squad_id into mine from public.squad_members m where m.user_id = uid and m.left_at is null;

  return query
  with seats as (
    select m.squad_id,
           sum(greatest(0, least(coalesce((m.left_at at time zone 'utc')::date, w.last_day), w.last_day)
                           - greatest((m.joined_at at time zone 'utc')::date, w.first_day) + 1))::numeric / w.days_elapsed as seats,
           count(*) filter (where (m.joined_at at time zone 'utc')::date <= w.last_day
                              and (m.left_at is null or (m.left_at at time zone 'utc')::date > w.last_day))::int as members
    from public.squad_members m
    group by m.squad_id
  ),
  totals as (
    select l.squad_id, sum(l.points)::bigint as points
    from public.points_ledger l
    where l.season = squad_standings.season and l.squad_id is not null
    group by l.squad_id
  ),
  scored as (
    select s.id, s.name, s.city, coalesce(t.points, 0) as points, coalesce(st.members, 0) as members,
           case when coalesce(st.seats, 0) > 0 then round(coalesce(t.points, 0) / st.seats)::bigint else 0 end as score
    from public.squads s
    left join seats st on st.squad_id = s.id
    left join totals t on t.squad_id = s.id
    where (coalesce(t.points, 0) > 0 or s.id = mine)
      and (in_city is null or lower(btrim(s.city)) = lower(btrim(in_city)))
  ),
  ranked as (
    select case when sc.members >= 3 then rank() over (partition by sc.members >= 3 order by sc.score desc) end as rank, sc.*
    from scored sc
  )
  select r.rank, r.id, r.name, r.city, r.score, r.points, r.members, r.members >= 3, r.id is not distinct from mine
  from ranked r
  where r.rank <= least(greatest(coalesce(max_rows, 50), 1), 100) or r.id is not distinct from mine or r.rank is null
  order by r.rank nulls last, r.score desc, r.name
  limit 200;
end;
$$;

revoke all on function
  public.season_window(int),
  public.athlete_standings(int, text, int),
  public.squad_standings(int, text, int)
from public, anon, authenticated;

grant execute on function
  public.athlete_standings(int, text, int),
  public.squad_standings(int, text, int)
to authenticated;

-- Personal progress, with or without a squad (Caleb, 2026-11-22: "the social experience should enhance
-- the solo experience, not hold it hostage"). Read-only and computed from what already exists, so a
-- season reset loses nothing: all-time counts span every season.
--
--   season_points    the caller's points in the points ledger for that season (counted work only)
--   season_workouts  finished, kept workouts that season, verified or not (they count for the person)
--   counted_workouts workouts the scorer accepted that season
--   all_time_workouts finished, kept workouts ever (for milestones)
--   weekly_goal      days a week the person aims for (null when never set)
--   weeks            the last 12 weeks, oldest first: {"week_start": date, "days": n}; the last is this week
--   goal_streak      consecutive weeks up to now that reached the goal (this week counts once reached;
--                    until then the streak runs to last week, so an unfinished week never breaks it)
--   best_streak      the longest such run ever
--
-- Weeks run Monday to Sunday in the person's home time zone, like squad_week_goals(). A day counts once
-- it has a finished workout (submitted, accepted or waiting for review), the same rule as the goal.
-- Past weeks are judged against the current goal. No points come from any of this.

create function public.my_progress(season int)
returns table (
  season_points bigint,
  season_workouts int,
  counted_workouts int,
  all_time_workouts int,
  weekly_goal int,
  weeks jsonb,
  goal_streak int,
  best_streak int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  tz text;
  goal int;
  this_week date;
  first_week date;
  run int := 0;
  best int := 0;
  streak int := 0;
  w record;
  week_days jsonb;
begin
  select coalesce(pp.home_timezone, 'UTC'), pp.weekly_commitment into tz, goal
    from public.profile_private pp where pp.user_id = uid;
  this_week := date_trunc('week', now() at time zone coalesce(tz, 'UTC'))::date;

  select min(date_trunc('week', s.local_date))::date into first_week
  from public.workout_sessions s
  where s.user_id = uid and s.state in ('submitted', 'accepted', 'needs_review');

  if goal is not null and first_week is not null then
    for w in
      select g::date as wk, coalesce(m.days, 0) as days
      from generate_series(first_week, this_week, interval '7 days') g
      left join (
        select date_trunc('week', s.local_date)::date as week_start, count(distinct s.local_date)::int as days
        from public.workout_sessions s
        where s.user_id = uid and s.state in ('submitted', 'accepted', 'needs_review')
        group by 1
      ) m on m.week_start = g::date
      order by g
    loop
      if w.days >= goal then
        run := run + 1;
        best := greatest(best, run);
      elsif w.wk < this_week then
        run := 0; -- a finished week that missed the goal
      end if;
    end loop;
    -- `run` now ends at this week if it was reached, else at last week (this week is still open).
    streak := run;
  end if;

  select jsonb_agg(jsonb_build_object('week_start', g::date, 'days', coalesce(m.days, 0)) order by g)
    into week_days
  from generate_series(this_week - 77, this_week, interval '7 days') g
  left join (
    select date_trunc('week', s.local_date)::date as week_start, count(distinct s.local_date)::int as days
    from public.workout_sessions s
    where s.user_id = uid and s.state in ('submitted', 'accepted', 'needs_review')
      and s.local_date >= this_week - 77
    group by 1
  ) m on m.week_start = g::date;

  return query
  select
    (select coalesce(sum(l.points), 0)::bigint from public.points_ledger l where l.user_id = uid and l.season = my_progress.season),
    (select count(*)::int from public.workout_sessions s
      where s.user_id = uid and s.state in ('submitted', 'accepted', 'needs_review')
        and extract(year from s.local_date)::int = my_progress.season),
    (select count(*)::int from public.workout_sessions s join public.workout_scores ws on ws.session_id = s.id
      where s.user_id = uid and ws.status = 'accepted' and extract(year from s.local_date)::int = my_progress.season),
    (select count(*)::int from public.workout_sessions s
      where s.user_id = uid and s.state in ('submitted', 'accepted', 'needs_review')),
    goal,
    coalesce(week_days, '[]'::jsonb),
    streak,
    best;
end;
$$;

revoke all on function public.my_progress(int) from public, anon, authenticated;
grant execute on function public.my_progress(int) to authenticated;

-- Weekly goals shared with the squad.
--
-- Each member's weekly goal (profile_private.weekly_commitment, days a week) and how many days they
-- have trained this week, readable by the members of their current squad only. Decided by Caleb
-- 2026-11-19: goals are always shared with the squad (no hide setting), a day counts once it has a
-- finished workout (submitted, accepted or waiting for review; not discarded, expired or rejected),
-- weeks run Monday to Sunday in each member's own home time zone, and a changed goal applies to the
-- current week straight away. The goal earns and costs no points.
--
-- Only counts leave the database: no workout details, distance, location or health data.

create function public.squad_week_goals()
returns table (
  user_id uuid,
  display_name text,
  is_me boolean,
  weekly_goal int,
  days_this_week int,
  week_start date
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select public.require_user_uid() as uid
  ),
  my_squad as (
    select m.squad_id
    from public.squad_members m, me
    where m.user_id = me.uid and m.left_at is null
  ),
  people as (
    -- The current members of my squad (me included), or just me when I'm not in one.
    select me.uid as user_id, null::timestamptz as joined_at from me where not exists (select 1 from my_squad)
    union all
    select m.user_id, m.joined_at
    from public.squad_members m
    join my_squad s on s.squad_id = m.squad_id
    where m.left_at is null
  ),
  weeks as (
    select p.user_id,
           p.joined_at,
           pp.weekly_commitment,
           date_trunc('week', now() at time zone coalesce(pp.home_timezone, 'UTC'))::date as week_start
    from people p
    join public.profile_private pp on pp.user_id = p.user_id
  )
  select w.user_id,
         pr.display_name,
         w.user_id = (select uid from me),
         w.weekly_commitment,
         (select count(distinct s.local_date)::int
          from public.workout_sessions s
          where s.user_id = w.user_id
            and s.state in ('submitted', 'accepted', 'needs_review')
            and s.local_date >= w.week_start
            and s.local_date < w.week_start + 7),
         w.week_start
  from weeks w
  join public.profiles pr on pr.id = w.user_id
  -- Me first, then teammates in the order they joined.
  order by (w.user_id = (select uid from me)) desc, w.joined_at, pr.display_name;
$$;

revoke all on function public.squad_week_goals() from public, anon, authenticated;
grant execute on function public.squad_week_goals() to authenticated;

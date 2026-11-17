-- Squad activity: what teammates did recently, the accountability part of a squad.
--
-- Workouts are owner-only (row-level security), so teammates read them only through this function,
-- which returns a summary: who, which activity, when, how long, and the points it earned. No route,
-- no coordinates, no distance, no health data (hard rule 7, docs/data-integrity.md §3).
-- Only workouts done while in the caller's current squad are shown.

create function public.squad_activity(days int default 14, max_rows int default 100)
returns table (
  session_id uuid,
  user_id uuid,
  display_name text,
  activity text,
  local_date date,
  ended_at timestamptz,
  active_minutes int,
  status text,
  points int,
  is_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  mine uuid;
begin
  select m.squad_id into mine from public.squad_members m where m.user_id = uid and m.left_at is null;
  if mine is null then
    return;
  end if;

  return query
    select w.id, w.user_id, p.display_name, w.activity, w.local_date, w.ended_at,
           (coalesce(w.active_seconds, 0) / 60)::int,
           coalesce(s.status, 'submitted'),
           coalesce(s.total, 0),
           w.user_id = uid
    from public.workout_sessions w
    join public.profiles p on p.id = w.user_id
    left join public.workout_scores s on s.session_id = w.id
    where w.squad_id = mine
      -- Current members only: someone who left takes their activity feed with them.
      and exists (select 1 from public.squad_members m where m.squad_id = mine and m.user_id = w.user_id and m.left_at is null)
      and w.state in ('submitted', 'accepted', 'needs_review', 'rejected')
      and w.ended_at > now() - make_interval(days => least(greatest(coalesce(days, 14), 1), 60))
    order by w.ended_at desc
    limit least(greatest(coalesce(max_rows, 100), 1), 200);
end;
$$;

revoke all on function public.squad_activity(int, int) from public, anon, authenticated;
grant execute on function public.squad_activity(int, int) to authenticated;

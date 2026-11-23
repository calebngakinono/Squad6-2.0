-- Try again: an athlete can ask the server to score one of their own finished workouts again.
--
-- Scoring normally runs inside Finish (the workout_score_on_finish trigger), so a finished workout
-- always has a score once scoring is switched on. This is the recovery path the app offers when one
-- still shows no score after a minute. It reruns the same scorer for that day: score_day updates scores
-- in place and settles the points ledger to what each workout should have, so calling it any number of
-- times never awards points twice. It changes no rule.
--
-- Errors (SQLSTATE P0001): workout_not_found (missing or someone else's), workout_not_finished.

create function public.rescore_my_workout(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
  s public.workout_sessions;
begin
  select * into s from public.workout_sessions where id = target and user_id = uid;
  if s.id is null then
    raise exception 'workout_not_found' using errcode = 'P0001';
  end if;
  if s.state not in ('submitted', 'accepted', 'needs_review') then
    raise exception 'workout_not_finished' using errcode = 'P0001';
  end if;
  perform public.score_workout_day(s.id);
end;
$$;

revoke all on function public.rescore_my_workout(uuid) from public, anon, authenticated;
grant execute on function public.rescore_my_workout(uuid) to authenticated;

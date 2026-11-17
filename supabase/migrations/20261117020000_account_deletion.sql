-- destructive-ok: defines delete_my_account(), which deletes only the CALLER's own auth user when they
-- choose Delete account in the app (required by Apple). Running this migration deletes nothing.
-- Account deletion from inside the app (required by Apple, and docs/data-integrity.md §6).
--
-- delete_my_account() removes the athlete's sign-in and everything personal: profile, private
-- settings, squad memberships, join requests, workouts with their GPS points, steps, Apple Health
-- summaries and scores. If they captain a squad, captaincy passes on first (the same rule as leaving).
-- Points already counted for a squad stay in the ledger, so teammates' standings do not change, but
-- those rows no longer point at a person (points_ledger.user_id becomes null).
--
-- Done in the database rather than a separate server so it is one transaction: either everything
-- above happens, or nothing does.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user_uid();
begin
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  -- Leave the squad properly first: hands over captaincy, or archives a squad that becomes empty.
  if exists (select 1 from public.squad_members where user_id = uid and left_at is null) then
    perform public.end_membership(uid, 'left');
  end if;

  -- Cascades to the profile and everything that belongs to it.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;

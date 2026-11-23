-- REMOVE STAGING DEMO DATA. Never run on production (it refuses to).
--
-- Undoes supabase/demo/staging-demo.sql: removes the demo athletes (emails ending in
-- @demo.squadsix.invalid), the "Demo · ..." squads with their chat, every workout recorded by the demo seed
-- (device id "demo-seed") and the points the scoring engine awarded for them. The presenter account itself
-- is kept (it is a real login): it just leaves the demo squad, and its demo workouts and points are removed.
-- Nothing else is touched.

begin;

do $$
begin
  if not exists (select 1 from public.deployment_environment where name in ('staging', 'local')) then
    raise exception 'Refusing to remove demo data: this database is not marked as staging.';
  end if;
end;
$$;

create temp table demo_users on commit drop as
select id from auth.users where email like '%@demo.squadsix.invalid';
create temp table demo_squad_ids on commit drop as
select id from public.squads where name like 'Demo · %' and description = 'Demo squad for testing. These are not real people or real workouts.';
create temp table demo_sessions on commit drop as
select id from public.workout_sessions where device_id = 'demo-seed';

-- Points: the ledger keeps a row when a person is deleted, so take the demo rows out first.
delete from public.points_ledger
where (source_type = 'workout' and source_id in (select id from demo_sessions))
   or user_id in (select id from demo_users)
   or squad_id in (select id from demo_squad_ids);

-- Challenge entries in demo squads, or by demo athletes (the presenter's demo-week entries included).
delete from public.challenge_participants
where user_id in (select id from demo_users) or squad_id in (select id from demo_squad_ids);

-- Workouts recorded by the seed (scores, metrics, sets and events go with them).
delete from public.workout_sessions where id in (select id from demo_sessions);

-- The squads (members, chat, reactions, reads, home cities, invite codes and join requests go with them).
delete from public.squads where id in (select id from demo_squad_ids);

-- The demo athletes (their profiles go with them).
delete from auth.users where id in (select id from demo_users);

commit;

select
  (select count(*) from auth.users where email like '%@demo.squadsix.invalid') as demo_athletes_left,
  (select count(*) from public.squads where name like 'Demo · %') as demo_squads_left,
  (select count(*) from public.workout_sessions where device_id = 'demo-seed') as demo_workouts_left;

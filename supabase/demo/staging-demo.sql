-- STAGING DEMO DATA (version 2). Never run on production.
--
-- Fills staging with clearly fake squads, athletes, workouts, challenges and chat so every screen has
-- something to show, plus an optional PRESENTER account: a real login you create in the app, placed as
-- captain of a busy demo squad, for presenting the app. How to run it: docs/deployment.md
-- ("Staging demo data").
--
-- What it creates (all labelled as demo):
--   * 40 demo athletes: names start with "Demo", emails end in @demo.squadsix.invalid, no password, so nobody
--     can sign in as them. One extra demo athlete has no squad and is asking to join the presenter's squad.
--   * 8 squads named "Demo · ...", in Saint George, Salt Lake City, Denver (US), Toronto (CA) and London (GB).
--     "Demo · Trail Starters" has 3 members (earns points, not ranked: the four-member rule). "Demo · Wasatch
--     Wolves" has planned a new home city for next season. "Demo · Summit Crew" is the presenter's squad.
--   * Workouts over the last 8 weeks up to now (device id "demo-seed"), with the measurements a phone would
--     record. Running the script again tops it up to today. The presenter has no workout today, so finishing
--     one live during a presentation paints today's mark.
--   * Weekly tiers and Squad week joined for this week; chat messages, workout shares and reactions in every
--     demo squad; one demo athlete hidden from the People rankings.
--   * Points are NOT inserted: the real scoring engine scores the workouts (and challenges) when this script
--     runs, exactly as it scores real ones, so every point traces to a workout and rule v1. Workout shares in
--     chat copy the server's own score, like the app's Share button.
--
-- Safe to run again: fixed ids, existing rows are left alone, it only adds rows. To remove all of it, run
-- supabase/demo/staging-demo-remove.sql.

begin;

-- 0. The presenter ---------------------------------------------------------------------------------
-- 1) In the app (pointed at staging), create an account with this email and finish onboarding.
-- 2) Put the email below (leave it empty to skip). The account must not be in another squad.
create temp table demo_settings (presenter_email text) on commit drop;
insert into demo_settings values ('');  -- e.g. 'presenter@yourdomain.com'

-- 1. Refuse to run anywhere that is not marked as staging (or a developer's local database) -------
-- Staging is marked once with:  insert into public.deployment_environment (name) values ('staging');
do $$
begin
  if not exists (select 1 from public.deployment_environment where name in ('staging', 'local')) then
    raise exception 'Refusing to load demo data: this database is not marked as staging. On STAGING only, run once: '
      'insert into public.deployment_environment (name) values (''staging''); then run this script again.';
  end if;
end;
$$;

-- 2. Scoring on (staging only), early enough for 8 weeks of demo workouts ----------------------------
select public.set_scoring_active('v1', least(
  coalesce((select active_from from public.scoring_rule_versions where version = 'v1'), 'infinity'::timestamptz),
  date_trunc('day', now()) - interval '63 days'));

-- 3. Squads and athletes ----------------------------------------------------------------------------
-- A stable pseudo-random number 0-999 from a text seed, so every run produces the same data.
create function pg_temp.h(seed text) returns int language sql immutable as $$
  select abs(('x' || substr(md5(seed), 1, 8))::bit(32)::int) % 1000;
$$;
create function pg_temp.id(seed text) returns uuid language sql immutable as $$
  select md5('squadsix-demo-' || seed)::uuid;
$$;

create temp table demo_squads (n int primary key, name text, city_id bigint, tz text, size int, keenness int) on commit drop;
insert into demo_squads values
  (1, 'Demo · Red Rocks Runners', 5546220, 'America/Denver',  6, 65),
  (2, 'Demo · Dawn Patrol',       5546220, 'America/Denver',  4, 75),
  (3, 'Demo · Trail Starters',    5546220, 'America/Denver',  3, 70),
  (4, 'Demo · Wasatch Wolves',    5780993, 'America/Denver',  5, 55),
  (5, 'Demo · Mile High Six',     5419384, 'America/Denver',  6, 50),
  (6, 'Demo · Lakeshore Movers',  6167865, 'America/Toronto', 6, 60),
  (7, 'Demo · Thames Striders',   2643743, 'Europe/London',   4, 70),
  -- The presenter's squad: 5 demo members, and the presenter as captain makes 6.
  (8, 'Demo · Summit Crew',       5546220, 'America/Denver',  5, 80);

create temp table demo_people on commit drop as
select s.n as squad, p, pg_temp.id('user-' || s.n || '-' || p) as user_id, s.tz, s.city_id, s.keenness,
       'Demo ' || (array['Ana','Ben','Cleo','Dev','Eli','Fay','Gus','Hana','Ivo','Jade','Kai','Lena','Milo','Nia',
                         'Omar','Pia','Quin','Rosa','Sami','Tess','Uma','Vic','Wren','Xavi','Yara','Zane','Abe',
                         'Bea','Cy','Dina','Ezra','Flo','Gio','Hope','Ines','Jules','Kofi','Lior','Mara','Noor',
                         'Otto','Paz','Remy','Sol','Tara','Ugo','Vera','Wes'])[(s.n - 1) * 6 + p]
         || ' ' || chr(64 + 1 + pg_temp.h('initial' || s.n || p) % 26) || '.' as display_name
from demo_squads s, generate_series(1, s.size) p;

-- One demo athlete without a squad, asking to join the presenter's squad.
insert into demo_people values (0, 1, pg_temp.id('user-extra-1'), 'America/Denver', 5546220, 60, 'Demo Rafa M.');

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'demo-' || squad || '-' || p || '@demo.squadsix.invalid', now() - interval '70 days', now() - interval '70 days'
from demo_people
on conflict (id) do nothing;

-- The signup trigger created the profiles; fill them in.
update public.profiles pr set display_name = d.display_name, city_id = d.city_id
from demo_people d where pr.id = d.user_id and pr.display_name is distinct from d.display_name;
update public.profile_private pp set home_timezone = d.tz, weekly_commitment = 3 + d.p % 2,
       onboarding_completed_at = coalesce(pp.onboarding_completed_at, now() - interval '70 days')
from demo_people d where pp.user_id = d.user_id and pp.home_timezone is null;

-- The presenter: must exist (created in the app) and not be in another squad.
create temp table demo_presenter on commit drop as
select u.id as user_id from auth.users u, demo_settings s
where s.presenter_email <> '' and lower(u.email) = lower(s.presenter_email);
do $$
begin
  if (select presenter_email from demo_settings) <> '' and not exists (select 1 from demo_presenter) then
    raise exception 'No account with the presenter email yet: create it in the app (pointed at staging) first.';
  end if;
  if exists (select 1 from public.squad_members m join demo_presenter p on p.user_id = m.user_id
             where m.left_at is null and m.squad_id <> md5('squadsix-demo-squad-8')::uuid) then
    raise exception 'The presenter account is in another squad. Leave it in the app first, then run this again.';
  end if;
end;
$$;
update public.profiles pr set city_id = 5546220 from demo_presenter p where pr.id = p.user_id and pr.city_id is null;
update public.profile_private pp set home_timezone = coalesce(pp.home_timezone, 'America/Denver'),
       weekly_commitment = coalesce(pp.weekly_commitment, 4),
       onboarding_completed_at = coalesce(pp.onboarding_completed_at, now())
from demo_presenter p where pp.user_id = p.user_id;

insert into public.squads (id, name, city, city_id, description, created_by, created_at)
select pg_temp.id('squad-' || s.n), s.name, 'demo', s.city_id,
       'Demo squad for testing. These are not real people or real workouts.',
       pg_temp.id('user-' || s.n || '-1'), now() - interval '70 days'
from demo_squads s
on conflict (id) do nothing;

insert into public.squad_members (id, squad_id, user_id, role, joined_at)
select pg_temp.id('member-' || d.squad || '-' || d.p), pg_temp.id('squad-' || d.squad), d.user_id,
       -- In the presenter's squad the presenter is captain, so the demo members are not.
       case when d.p = 1 and (d.squad <> 8 or not exists (select 1 from demo_presenter)) then 'captain' else 'member' end,
       now() - interval '70 days'
from demo_people d
where d.squad > 0
on conflict (id) do nothing;

-- If squad 8 was loaded earlier without a presenter, hand the captaincy over now (one captain at a time).
update public.squad_members set role = 'member'
where squad_id = pg_temp.id('squad-8') and role = 'captain' and exists (select 1 from demo_presenter)
  and user_id not in (select user_id from demo_presenter);
insert into public.squad_members (id, squad_id, user_id, role, joined_at)
select pg_temp.id('member-presenter'), pg_temp.id('squad-8'), p.user_id, 'captain', now() - interval '70 days'
from demo_presenter p
on conflict (id) do nothing;

insert into public.squad_invite_codes (squad_id, code)
select pg_temp.id('squad-' || n), public.generate_invite_code() from demo_squads
on conflict (squad_id) do nothing;

-- A pending request to join the presenter's squad (the captain's "Waiting to join").
insert into public.squad_join_requests (id, squad_id, user_id, status, created_at, note)
select pg_temp.id('request-extra-1'), pg_temp.id('squad-8'), pg_temp.id('user-extra-1'), 'pending', now() - interval '3 hours',
       'Demo request: I run before work most days and want a squad that keeps me honest.'
where exists (select 1 from demo_presenter)
on conflict (id) do nothing;

-- Wasatch Wolves have planned a move to Saint George from next season; one athlete hides from rankings.
insert into public.squad_home_cities (squad_id, from_season, city_id)
values (pg_temp.id('squad-4'), extract(year from now())::int + 1, 5546220)
on conflict do nothing;
update public.profile_private set hide_from_rankings = true where user_id = pg_temp.id('user-5-6');

-- 4. Workouts ---------------------------------------------------------------------------------------
-- At most one per athlete per day, over the last 8 weeks up to now. Plausible paces and durations only.
-- The presenter trains often but has no workout today (finish one live to paint today's mark).
create temp table demo_trainees on commit drop as
select user_id, squad, tz, keenness from demo_people where squad > 0
union all
select p.user_id, 8, 'America/Denver', 85 from demo_presenter p;

create temp table demo_workouts on commit drop as
with days as (
  select d.*, day::date as local_date, pg_temp.h('day' || d.user_id || day) as roll
  from demo_trainees d,
       generate_series((now() at time zone d.tz)::date - 55, (now() at time zone d.tz)::date, interval '1 day') day
), picked as (
  select *,
         (array['run', 'walk', 'run', 'cycle', 'strength', 'walk'])[1 + pg_temp.h('activity' || user_id || local_date) % 6] as activity,
         pg_temp.h('minutes' || user_id || local_date) as r1,
         pg_temp.h('pace' || user_id || local_date) as r2
  from days
  where roll < keenness * 10
    and not (user_id in (select user_id from demo_presenter) and local_date = (now() at time zone tz)::date)
), timed as (
  select *,
         case activity when 'run' then 25 + r1 % 31 when 'walk' then 25 + r1 % 36
                       when 'cycle' then 35 + r1 % 41 else 35 + r1 % 26 end as minutes,
         ((local_date + make_interval(hours => 6 + r2 % 13, mins => r1 % 60)) at time zone tz) as started_at
  from picked
)
select pg_temp.id('workout-' || user_id || '-' || local_date) as id, user_id, squad, tz, local_date, activity, minutes,
       started_at, r2
from timed
-- Only workouts that are already over.
where started_at + make_interval(mins => minutes) < now();

insert into public.workout_sessions
  (id, user_id, client_session_id, activity, state, version, started_at, ended_at, active_seconds,
   home_timezone, local_date, squad_id, device_id, created_at)
select w.id, w.user_id, w.id, w.activity, 'submitted', 2, w.started_at, w.started_at + make_interval(mins => w.minutes),
       w.minutes * 60, w.tz, w.local_date, pg_temp.id('squad-' || w.squad), 'demo-seed', w.started_at
from demo_workouts w
on conflict (id) do nothing;

insert into public.workout_session_events (session_id, client_event_id, kind, server_at, client_at, effective_at, device_id)
select w.id, pg_temp.id('event-' || w.id || '-' || e.kind), e.kind, e.at, e.at, e.at, 'demo-seed'
from demo_workouts w,
     lateral (values ('start', w.started_at), ('finish', w.started_at + make_interval(mins => w.minutes))) e (kind, at)
on conflict (session_id, client_event_id) do nothing;

-- Strength: sets logged live, evenly spread through the workout.
insert into public.strength_sets (session_id, client_set_id, exercise, reps, weight_kg, server_at, client_at, effective_at)
select w.id, pg_temp.id('set-' || w.id || '-' || i),
       (array['Squat', 'Bench press', 'Deadlift', 'Row', 'Overhead press', 'Lunge'])[1 + i % 6], 6 + (w.r2 + i) % 7, null, t, t, t
from demo_workouts w,
     generate_series(0, 7 + w.r2 % 11) i,
     lateral (select w.started_at + make_interval(secs => 60 + i * ((w.minutes * 60 - 120.0) / (7 + w.r2 % 11)))) s (t)
where w.activity = 'strength'
on conflict (session_id, client_set_id) do nothing;

-- Measurements a phone would have recorded. Distance from a plausible pace for each activity.
insert into public.workout_metrics (session_id, metric, value, source, provenance)
select w.id, m.metric, m.value, m.source, 'live'
from demo_workouts w,
     lateral (select case w.activity
                       when 'run' then w.minutes / (5.0 + (w.r2 % 26) / 10.0)              -- 5:00 to 7:30 per km
                       when 'walk' then w.minutes / 60.0 * (4.8 + (w.r2 % 16) / 10.0)      -- 4.8 to 6.3 km/h
                       when 'cycle' then w.minutes / 60.0 * (17 + w.r2 % 12)               -- 17 to 28 km/h
                     end as km) d,
     lateral (values
       ('distance_m', round(d.km * 1000, 1), 'gps'),
       ('gps_coverage', 0.85 + (w.r2 % 14) / 100.0, 'gps'),
       ('gps_points', w.minutes * 55, 'gps'),
       ('gps_excluded_m', 0, 'gps'),
       ('gps_mocked_points', 0, 'gps'),
       ('steps', round(w.minutes * case w.activity when 'run' then 160 else 110 end), 'pedometer'),
       ('motion_coverage', 0.8 + (w.r2 % 16) / 100.0, 'pedometer')
     ) m (metric, value, source)
where w.activity in ('run', 'walk', 'cycle')
  and not (w.activity = 'cycle' and m.source = 'pedometer') -- the app does not count steps on rides
on conflict on constraint workout_metrics_pkey do nothing;

-- 5. This week's challenges (joined at the start of the week, so this week's workouts count) ---------
do $$
declare
  t record;
  starts timestamptz;
begin
  for t in select * from demo_trainees loop
    starts := (date_trunc('week', now() at time zone t.tz)) at time zone t.tz;
    begin
      perform public.challenge_join_at(t.user_id, 'weekly-tiers-v1', 'current', starts + interval '1 minute');
    exception when others then null; -- already joined, or the challenge isn't running: leave it
    end;
    if t.squad in (1, 2, 8) then
      begin
        perform public.challenge_join_at(t.user_id, 'squad-week-v1', 'current', starts + interval '1 minute');
      exception when others then null;
      end;
    end if;
  end loop;
end;
$$;

-- 6. Score every demo day with the real scoring engine (workouts, then challenges). Running it again
-- changes nothing: a workout is awarded once.
select count(public.score_day(user_id, local_date)) as days_scored
from (select distinct w.user_id, w.local_date from public.workout_sessions w
      where w.device_id = 'demo-seed' and w.local_date >= current_date - 60) x;

-- 7. Squad chat: a few messages, shared workouts (copied from the server's own score) and reactions ----
create temp table demo_lines (k int primary key, body text) on commit drop;
insert into demo_lines values
  (1, 'Morning crew, who''s getting one in before work?'),
  (2, 'Done. Legs are complaining but I''m on the board for today.'),
  (3, 'Rest day for me, back at it tomorrow.'),
  (4, 'Two more counted workouts and I hit Silver this week.'),
  (5, 'Anyone up for the long loop on Saturday?'),
  (6, 'In. 7 am at the trailhead?'),
  (7, 'Proud of this squad. Everyone''s on the board this week.'),
  (8, 'Missed yesterday, making it up today.');

-- Text messages: 6 per squad over the last 3 days, from different members.
insert into public.squad_messages (id, squad_id, user_id, kind, body, created_at)
select pg_temp.id('msg-' || s.n || '-' || g.i), pg_temp.id('squad-' || s.n),
       pg_temp.id('user-' || s.n || '-' || (1 + (g.i + s.n) % s.size)), 'text',
       (select l.body from demo_lines l where l.k = 1 + (s.n + g.i) % 8),
       now() - make_interval(hours => (6 - g.i) * 11 + 1)
from demo_squads s, generate_series(1, 6) g (i)
on conflict (id) do nothing;

-- Each squad: the latest workout of two members, shared to the chat.
insert into public.squad_messages (id, squad_id, user_id, kind, body, workout_session_id, workout, created_at)
select pg_temp.id('share-' || s.n || '-' || k), pg_temp.id('squad-' || s.n), w.user_id, 'workout',
       case k when 1 then 'Today''s one.' else null end, w.id,
       jsonb_build_object('activity', w.activity, 'active_minutes', round(w.active_seconds / 60.0), 'local_date', w.local_date,
         'outcome', case when sc.status = 'accepted' then 'counted'
                         when sc.status = 'recorded' and cardinality(sc.categories) = 0 then 'unverified' else 'other' end,
         'points', case when sc.status = 'accepted' then sc.total else 0 end),
       w.ended_at + interval '10 minutes'
from demo_squads s, generate_series(1, 2) k,
     lateral (select * from public.workout_sessions ws
              where ws.user_id = pg_temp.id('user-' || s.n || '-' || k) and ws.device_id = 'demo-seed'
              order by ws.started_at desc limit 1) w
left join public.workout_scores sc on sc.session_id = w.id
on conflict (id) do nothing;

-- The presenter shares their latest workout too.
insert into public.squad_messages (id, squad_id, user_id, kind, body, workout_session_id, workout, created_at)
select pg_temp.id('share-presenter'), pg_temp.id('squad-8'), w.user_id, 'workout', 'Yesterday''s session.', w.id,
       jsonb_build_object('activity', w.activity, 'active_minutes', round(w.active_seconds / 60.0), 'local_date', w.local_date,
         'outcome', case when sc.status = 'accepted' then 'counted'
                         when sc.status = 'recorded' and cardinality(sc.categories) = 0 then 'unverified' else 'other' end,
         'points', case when sc.status = 'accepted' then sc.total else 0 end),
       w.ended_at + interval '10 minutes'
from demo_presenter p,
     lateral (select * from public.workout_sessions ws where ws.user_id = p.user_id and ws.device_id = 'demo-seed'
              order by ws.started_at desc limit 1) w
left join public.workout_scores sc on sc.session_id = w.id
on conflict (id) do nothing;

-- Reactions from squadmates on the shares.
insert into public.squad_message_reactions (message_id, squad_id, user_id, reaction, created_at)
select m.id, m.squad_id, pg_temp.id('user-' || s.n || '-' || r.p),
       (array['strong', 'fire', 'clap', 'like'])[1 + (r.p + s.n) % 4], m.created_at + interval '20 minutes'
from demo_squads s
join public.squad_messages m on m.squad_id = pg_temp.id('squad-' || s.n) and m.kind = 'workout'
cross join lateral (select p from generate_series(1, s.size) p where pg_temp.id('user-' || s.n || '-' || p) <> m.user_id limit 3) r
on conflict do nothing;

-- The presenter has read everything except the last day or so.
insert into public.squad_chat_reads (squad_id, user_id, last_read_at)
select pg_temp.id('squad-8'), p.user_id, now() - interval '30 hours' from demo_presenter p
on conflict (squad_id, user_id) do nothing;

commit;

-- What was loaded:
select s.name, public.city_label(s.city_id) as founding_city, count(distinct m.user_id) as members,
       (select count(*) from public.workout_sessions w where w.squad_id = s.id) as workouts,
       coalesce((select sum(points) from public.points_ledger l where l.squad_id = s.id), 0) as points,
       (select count(*) from public.squad_messages c where c.squad_id = s.id) as chat_messages
from public.squads s join public.squad_members m on m.squad_id = s.id and m.left_at is null
where s.name like 'Demo · %'
group by s.id order by points desc;

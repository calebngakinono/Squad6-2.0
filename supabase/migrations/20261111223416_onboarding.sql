-- Onboarding: versioned flow configuration, resumable progress, and one server function that applies
-- the answers to the profile. Flow structure is validated by onboardingFlowSchema in packages/shared
-- (a unit test parses the v1 definition below).

-- 1. Flow configuration ------------------------------------------------------------------------

create table public.onboarding_flows (
  version int primary key check (version > 0),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.onboarding_flows is
  'Onboarding questions as config. Changed only by migrations. Exactly one flow is active.';

create unique index onboarding_flows_one_active on public.onboarding_flows (active) where active;

alter table public.onboarding_flows enable row level security;
create policy "onboarding_flows: signed-in users can read"
  on public.onboarding_flows for select to authenticated using (true);
revoke all on public.onboarding_flows from anon, authenticated;
grant select on public.onboarding_flows to authenticated;

-- 2. Progress on the private profile -----------------------------------------------------------

alter table public.profile_private
  add column onboarding_flow_version int references public.onboarding_flows (version),
  add column onboarding_step text check (char_length(onboarding_step) <= 40),
  add column onboarding_answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(onboarding_answers) = 'object' and pg_column_size(onboarding_answers) <= 16384);

-- Completion now goes through complete_onboarding(), which validates and applies the answers.
revoke update (onboarding_completed_at) on public.profile_private from authenticated;

create function public.save_onboarding_progress(flow_version int, current_step text, answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.onboarding_flows where version = flow_version) then
    raise exception 'unknown_flow' using errcode = 'P0001';
  end if;
  if jsonb_typeof(answers) <> 'object' or pg_column_size(answers) > 16384 then
    raise exception 'invalid_answers' using errcode = 'P0001';
  end if;

  update public.profile_private
  set onboarding_flow_version = flow_version,
      onboarding_step = left(current_step, 40),
      onboarding_answers = answers
  where user_id = uid;
end;
$$;

-- Applies the profile fields chosen during onboarding, then marks it complete. Safe to call again.
create function public.complete_onboarding(
  flow_version int,
  answers jsonb,
  display_name text,
  city text,
  home_timezone text,
  weekly_commitment int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.onboarding_flows where version = flow_version) then
    raise exception 'unknown_flow' using errcode = 'P0001';
  end if;
  if jsonb_typeof(answers) <> 'object' or pg_column_size(answers) > 16384 then
    raise exception 'invalid_answers' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(display_name, ''))) not between 1 and 80 then
    raise exception 'invalid_display_name' using errcode = 'P0001';
  end if;
  if city is not null and char_length(btrim(city)) not between 1 and 80 then
    raise exception 'invalid_city' using errcode = 'P0001';
  end if;
  if weekly_commitment is not null and weekly_commitment not between 1 and 14 then
    raise exception 'invalid_weekly_commitment' using errcode = 'P0001';
  end if;
  if home_timezone is null then
    raise exception 'timezone_required' using errcode = 'P0001';
  end if;

  -- Same rules as changing it later (valid name; at most one change per 7 days).
  perform public.set_home_timezone(home_timezone);

  update public.profiles
  set display_name = btrim(complete_onboarding.display_name),
      city = coalesce(nullif(btrim(complete_onboarding.city), ''), profiles.city)
  where id = uid;

  update public.profile_private
  set weekly_commitment = coalesce(complete_onboarding.weekly_commitment, profile_private.weekly_commitment),
      onboarding_flow_version = flow_version,
      onboarding_answers = answers,
      onboarding_step = null,
      onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where user_id = uid;
end;
$$;

revoke all on function public.save_onboarding_progress(int, text, jsonb) from public, anon;
revoke all on function public.complete_onboarding(int, jsonb, text, text, text, int) from public, anon;
grant execute on function public.save_onboarding_progress(int, text, jsonb) to authenticated;
grant execute on function public.complete_onboarding(int, jsonb, text, text, text, int) to authenticated;

-- 3. Flow v1: core questions. Placeholder copy until the designer's storyboard arrives. ----------
-- ONBOARDING_V1_START
insert into public.onboarding_flows (version, active, definition) values (1, true, $json$
{
  "version": 1,
  "steps": [
    {
      "id": "welcome",
      "type": "info",
      "title": "Fitness is easier when five people are counting on you",
      "body": "Join a squad of up to six, log live workouts, and keep each other consistent all season."
    },
    {
      "id": "display_name",
      "type": "text",
      "title": "What should your squad call you?",
      "field": "display_name",
      "maxLength": 80
    },
    {
      "id": "goal",
      "type": "single_choice",
      "title": "What's your main goal?",
      "options": [
        { "value": "consistency", "label": "Train more consistently" },
        { "value": "strength", "label": "Get stronger" },
        { "value": "endurance", "label": "Build endurance" },
        { "value": "health", "label": "Feel healthier" },
        { "value": "event", "label": "Train for an event" }
      ]
    },
    {
      "id": "experience",
      "type": "single_choice",
      "title": "How often do you train right now?",
      "options": [
        { "value": "new", "label": "I'm just starting" },
        { "value": "sometimes", "label": "A few times a month" },
        { "value": "regular", "label": "Most weeks" }
      ],
      "branches": [{ "when": { "step": "experience", "equals": "new" }, "goto": "beginner_tips" }],
      "next": "activities"
    },
    {
      "id": "beginner_tips",
      "type": "info",
      "title": "Start small, show up often",
      "body": "A 20-minute walk counts. Squad Six rewards showing up regularly far more than long or extreme workouts."
    },
    {
      "id": "activities",
      "type": "multi_choice",
      "title": "What do you like to do?",
      "body": "Pick any. You can log any activity later.",
      "required": false,
      "options": [
        { "value": "run", "label": "Running" },
        { "value": "walk", "label": "Walking or hiking" },
        { "value": "cycle", "label": "Cycling" },
        { "value": "swim", "label": "Swimming" },
        { "value": "strength", "label": "Strength training" },
        { "value": "hiit", "label": "HIIT or classes" },
        { "value": "yoga", "label": "Yoga or mobility" }
      ]
    },
    {
      "id": "weekly_commitment",
      "type": "number",
      "title": "How many days a week do you want to train?",
      "body": "A personal goal you can change anytime. It doesn't change your points.",
      "field": "weekly_commitment",
      "min": 1,
      "max": 14,
      "presets": [2, 3, 4, 5]
    },
    {
      "id": "city",
      "type": "text",
      "title": "Which city do you train in?",
      "body": "Squads compete within a city. Only the city is shown, never your exact location.",
      "field": "city",
      "maxLength": 80
    },
    {
      "id": "home_timezone",
      "type": "timezone",
      "title": "Confirm your home time zone",
      "body": "It decides which day a workout counts for. You can change it at most once a week.",
      "field": "home_timezone"
    },
    {
      "id": "wearables",
      "type": "multi_choice",
      "title": "Do you train with any of these?",
      "body": "Optional. They can add evidence to a workout, but you don't need one.",
      "required": false,
      "options": [
        { "value": "apple_watch", "label": "Apple Watch" },
        { "value": "other_watch", "label": "Another fitness watch" },
        { "value": "hr_strap", "label": "Heart-rate strap" },
        { "value": "none", "label": "None of these" }
      ]
    },
    {
      "id": "ready",
      "type": "info",
      "title": "You're set",
      "body": "Next, join a squad with an invite code or start your own."
    }
  ]
}
$json$::jsonb);
-- ONBOARDING_V1_END

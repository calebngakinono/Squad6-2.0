-- Onboarding before sign-up (flow v3).
--
-- The onboarding now runs before the account exists: a visitor answers on the phone, creates the
-- account near the end, and the answers are saved with complete_onboarding() right after sign-up.
-- So a visitor who is not signed in yet (the anon role) must be able to read the active flow and
-- search the public city list. Nothing else changes for anon: progress and completion still need a
-- signed-in user.

-- 1. Visitors can read the active flow only ------------------------------------------------------

create policy "onboarding_flows: visitors can read the active flow"
  on public.onboarding_flows for select to anon using (active);
grant select on public.onboarding_flows to anon;

-- 2. Visitors can search the city list (GeoNames public data) -------------------------------------

create policy "cities: visitors can read"
  on public.cities for select to anon using (true);
grant select on public.cities to anon;
grant execute on function public.search_cities(text, int) to anon;

-- 3. Flow v3: 15 screens that sell before they ask, sign-up on 14, Pro offer on 15 --------------
-- Copy agreed in the design handoff doc. Numbers on the gap and plan screens are computed in the app
-- from the person's own answers. Time zone is no longer asked: the app sends the phone's time zone,
-- which can be changed later in Settings.

update public.onboarding_flows set active = false where active;
-- ONBOARDING_V3_START
insert into public.onboarding_flows (version, active, definition) values (3, true, $json$
{
  "version": 3,
  "steps": [
    {
      "id": "welcome",
      "type": "info",
      "layout": "welcome",
      "title": "Five people are counting on you.",
      "body": "Work out with a squad of up to six. Earn points together, all season long.",
      "cta": "Get started"
    },
    {
      "id": "reason",
      "type": "single_choice",
      "title": "What brings you to Squad Six?",
      "options": [
        { "value": "routine", "label": "Get back into a routine" },
        { "value": "consistency", "label": "Stay consistent with what I already do" },
        { "value": "friends", "label": "Train with my friends" },
        { "value": "compete", "label": "Compete for my city" }
      ]
    },
    {
      "id": "days_now",
      "type": "number",
      "title": "How many days a week do you work out right now?",
      "body": "Be honest. Nobody sees this but you.",
      "min": 0,
      "max": 7,
      "presets": [0, 1, 2, 3, 4, 5, 6, 7]
    },
    {
      "id": "weekly_commitment",
      "type": "number",
      "title": "How many days a week do you want to work out?",
      "body": "This becomes your weekly goal. Your squad sees whether you hit it.",
      "field": "weekly_commitment",
      "min": 1,
      "max": 7,
      "presets": [1, 2, 3, 4, 5, 6, 7]
    },
    {
      "id": "gap",
      "type": "info",
      "layout": "gap",
      "title": "Here's the gap",
      "body": "You want {goal} workouts a week and do {current} today. That's how many you're leaving on the table.",
      "params": { "current": "days_now", "goal": "weekly_commitment" },
      "copy": {
        "unit": "workouts a year",
        "none_title": "You're already there.",
        "none_body": "The hard part is staying there. That's what a squad is for."
      }
    },
    {
      "id": "obstacles",
      "type": "multi_choice",
      "title": "What usually gets in the way?",
      "body": "Pick any that apply.",
      "options": [
        { "value": "busy", "label": "A busy schedule" },
        { "value": "motivation", "label": "I lose motivation after a few weeks" },
        { "value": "nobody_notices", "label": "Nobody notices when I skip" },
        { "value": "bored", "label": "I get bored of the same routine" },
        { "value": "energy", "label": "Low energy or injuries" },
        { "value": "unsure", "label": "I'm not sure where to start" }
      ]
    },
    {
      "id": "tried",
      "type": "multi_choice",
      "title": "What have you tried before?",
      "body": "Pick any that apply.",
      "options": [
        { "value": "gym", "label": "A gym membership" },
        { "value": "apps", "label": "Fitness apps or trackers" },
        { "value": "trainer", "label": "A personal trainer" },
        { "value": "friend", "label": "Working out with a friend" },
        { "value": "willpower", "label": "Willpower alone" },
        { "value": "nothing", "label": "Nothing yet" }
      ],
      "branches": [{ "when": { "step": "obstacles", "includes": "nobody_notices" }, "goto": "reframe_noticed" }],
      "next": "reframe"
    },
    {
      "id": "reframe_noticed",
      "type": "info",
      "title": "It's not your willpower.",
      "body": "You said it yourself: nobody notices when you skip. Most plans are built for one person, so skipping gets easy. Squad Six puts your workouts in front of five people chasing the same thing.",
      "cta": "Show me how",
      "next": "how_it_works"
    },
    {
      "id": "reframe",
      "type": "info",
      "title": "It's not your willpower.",
      "body": "Most plans are built for one person. When nobody notices you skipped, skipping gets easy. Squad Six puts your workouts in front of five people chasing the same thing.",
      "cta": "Show me how"
    },
    {
      "id": "how_it_works",
      "type": "info",
      "layout": "how_it_works",
      "title": "How Squad Six works",
      "items": [
        { "title": "Start a live workout", "body": "Run, lift, ride or walk. The app tracks it as it happens." },
        { "title": "Earn points you can trust", "body": "Points are checked with your phone's GPS and Apple Health, so every squad plays fair." },
        { "title": "Climb together", "body": "Your squad's points rank you in your city, your country and the world, all season." }
      ]
    },
    {
      "id": "squad",
      "type": "single_choice",
      "title": "Who are you training with?",
      "body": "You'll set this up right after.",
      "options": [
        { "value": "code", "label": "I have an invite code" },
        { "value": "start", "label": "I'll start a squad and invite friends" },
        { "value": "none", "label": "I don't have a squad yet" }
      ]
    },
    {
      "id": "display_name",
      "type": "text",
      "title": "What should your squad call you?",
      "body": "Your first name or a nickname. You can change it later.",
      "field": "display_name",
      "maxLength": 80
    },
    {
      "id": "city",
      "type": "city",
      "title": "Where do you train?",
      "body": "Your squad and the leaderboard show your city, never your exact location.",
      "field": "city"
    },
    {
      "id": "plan",
      "type": "info",
      "layout": "plan",
      "title": "Your plan is ready, {name}",
      "params": { "goal": "weekly_commitment", "squad": "squad", "name": "display_name", "city": "city" },
      "copy": {
        "goal": "{goal} workouts a week",
        "squad_code": "Join with your invite code",
        "squad_start": "Start your own squad",
        "squad_none": "Find a squad after setup",
        "season": "{weeks} weeks left in the {year} season"
      },
      "cta": "Save my plan"
    },
    {
      "id": "signup",
      "type": "signup",
      "title": "Save your plan",
      "body": "Create your account so your points and your squad are kept safe."
    },
    {
      "id": "paywall",
      "type": "paywall",
      "title": "Go further with Pro",
      "body": "Squad Six is free to use. Pro is coming soon and will add:",
      "items": [
        { "title": "Progress analytics", "body": "See your trends across the season." },
        { "title": "Captain tools", "body": "More ways to lead and grow your squad." },
        { "title": "Achievement history", "body": "Every streak and challenge you've earned, kept." }
      ],
      "cta": "Continue free"
    }
  ]
}
$json$::jsonb);
-- ONBOARDING_V3_END

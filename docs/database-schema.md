# Database schema

Revised 2026-11-10 for Squad Six. ✅ migrated · 🔁 migrated, to be reshaped · 📝 planned (added in the
migration for the feature that needs it). The migration is the source of truth; columns here are indicative.

| Table | Status | Purpose | Access |
|---|---|---|---|
| `profiles` | ✅ | **Public** profile, 1:1 with `auth.users`, created by the signup trigger: display name, `city_id` (a city from `cities`) and `city`, its label such as "Denver, Colorado", written by the database (avatar later). Wrench `experience_level` removed 2026-11-11 (approved). | Signed-in users read; owner updates `display_name`, `city_id` only (column grants); a city can no longer be typed |
| `cities` | ✅ | Fixed list of 34,215 cities: every city over 15,000 people plus smaller capitals (GeoNames `cities15000`, CC BY 4.0, built by `scripts/build-cities-seed.py`). Name, accent-free search name, region, country code and name, population. `search_cities(query, max_rows)` finds cities by the start of the name, biggest first (ignores case, accents and dots; "St" finds "Saint") | Read and search: signed in and visitors (`anon`, public GeoNames data, needed by onboarding before sign-up). Changed by migrations only |
| `profile_private` | ✅ | Home timezone (set only via `set_home_timezone()`: valid IANA name, at most one change per 7 days), weekly goal `weekly_commitment` (not scored; shared with the squad only through `squad_week_goals()`), onboarding answers (`onboarding_flow_version`, `onboarding_answers` ≤ 16 KB; `onboarding_step` unused since v3, which keeps progress on the phone) and completion | Owner only; owner updates `weekly_commitment`; progress via `save_onboarding_progress()`, completion via `complete_onboarding()` |
| `squads` | ✅ | Name, `city_id` (from `cities`, required when created) and its label `city`, description, created_by, archived_at (set when the last member leaves) | Signed-in read; writes via functions only |
| `squad_home_cities` | ✅ | A squad's home city from a season on (Caleb, 2026-11-22). Before any row, the founding city (`squads.city_id`) applies; `squad_city_for(squad, season)` picks the latest row at or before the season. The captain schedules next season's city with `set_squad_home_city()` (one city per season; choosing the current one cancels the plan); `my_squad_home_city()` returns this season's city and the plan | Members read; writes via the function only |
| `athlete_home_cities` | ✅ | The city a person competes in on the People board, per season. Written by a trigger on `profiles.city_id`: a new city counts this season until the person has points this season, then from next season (no mid-season move to a weaker city). `athlete_city_for(user, season)` reads it | Owner reads; trigger writes only |
| `squad_messages` | ✅ | Squad chat (Caleb, 2026-11-22): text (≤ 2,000 characters) or a shared workout whose `workout` snapshot the server builds from the score (activity, minutes, counted points or unverified). Soft delete keeps a placeholder. Realtime-published. Writes only through `send_squad_message`, `share_workout_to_squad`, `delete_squad_message` (sender or captain); 20 messages a minute per person | Current members read (`is_current_member`); leaving ends access |
| `squad_message_reactions` | ✅ | Like / strong / fire / clap per person per message, toggled by `toggle_squad_reaction`; carries `squad_id` so realtime can filter by squad. Realtime-published | Current members read |
| `squad_message_reports` | ✅ | One report per person per message (`report_squad_message`); operators review `chat_reports_awaiting_review` (docs/deployment.md) | Reporter reads own |
| `squad_chat_reads` | ✅ | When each member last read the chat (`mark_squad_chat_read`); `my_squad_chat_unread()` counts others' messages since then | Owner reads |
| `squad_members` | ✅ | Membership **history**: squad, user, role, joined_at, left_at, left_reason. One active squad per athlete, one captain per squad (unique indexes). Max six, enforced by locking the squad row on approval (race-tested) | Squadmates and self read; writes via functions only |
| `squad_invite_codes` | ✅ | One 8-character code per squad (no look-alike characters); captain can regenerate | Active members read |
| `squad_join_requests` | ✅ | pending → approved / declined / cancelled / expired. Max 3 pending per athlete; joining a squad cancels the others. Optional `note` (≤ 280 characters) from the person asking, for the captain | Requester and captain read; writes via functions only |
| `workout_sessions` | ✅ | Live session state machine (see architecture.md): activity, state, version, server `started_at`/`ended_at`, server-computed `active_seconds`, home time zone + scoring day + squad locked at start, `started_offline`. One open workout per athlete (partial unique index, race-tested); idempotent start on `client_session_id`; open > 12 h → `expired` | Owner reads; writes via functions only. Squad summary view comes with the feed |
| `workout_session_events` | ✅ | Append-only start/pause/resume/finish/cancel/expire log: server time, client time, clamped `effective_at`, `offline` flag; unique per client event id | Owner reads; written by functions only |
| `workout_route_points` | ✅ | Phone GPS fixes for a workout: time, latitude, longitude, accuracy, altitude, speed, `mocked` flag. One row per instant (re-sent batches add nothing). Only for run / walk / hike / ride | **Owner reads only** (precise location is never visible to anyone else); written by `add_route_points()` only |
| `workout_motion_samples` | ✅ | Phone steps per clock minute (`seconds` measured, `steps` 0–400). Re-sending a minute keeps the larger count | Owner reads; written by `add_motion_samples()` only |
| `workout_metrics` | ✅ | **Server-computed** measurements per workout with `source` and `provenance`: `distance_m`, `gps_coverage`, `gps_points`, `gps_mocked_points`, `gps_excluded_m` (source `gps`), `steps`, `motion_coverage` (source `pedometer`). Recomputed at finish and when late measurements arrive | Owner reads; written by the server only |
| `strength_sets` | ✅ | Exercise, reps (1–100), optional weight (manual, never scored); clamped time, `offline`, `after_finish` (logged ≤ 1 h after finishing: kept, not live evidence); soft delete while open | Owner reads; writes via functions only |
| `scoring_rule_versions` | ✅ | Versioned scoring config as JSON (v1 = approved rules). `active_from` null = scoring off; set per environment by `set_scoring_active()` (operators only) | Read: signed in. Write: migrations and operators only |
| `workout_scores` | ✅ | Scoring outcome per finished workout: status (`accepted`, `recorded`, `needs_review`, `merged`), evidence categories, base / verification / performance, daily factor, total, and a `detail` JSON with the facts and reasons shown to the athlete | Owner reads; written by the scorer only |
| `points_ledger` | ✅ | Append-only awards and adjustments: user, squad (locked at workout start), season, scoring day, source, rule version, kind (`award` / `adjustment`), revision, points, reason. Unique per source + rule version + kind + revision, so a workout is awarded once and each correction is its own row. `user_id` becomes null on account deletion (the row still counts for the squad) | Owner reads own; squad/leaderboards via views (later) |
| `workout_reviews` | ✅ | Append-only review decisions (`accepted` / `rejected`, reason, reviewer name); the latest per workout wins. `accepted` clears a plausibility flag; `rejected` sets the score to `rejected` with 0 points. Written by `review_workout()` (operators only), which re-scores the day. View `workouts_awaiting_review` lists flagged workouts (summaries only, operators only) | Owner reads decision and reason; operators write |
| `workout_evidence` | ✅ | Summary of a health-platform workout attached as evidence: provider (`healthkit`, later `health_connect`), platform record id, source app and device, times, server-computed `overlap`, optional distance, energy and heart-rate summary. A platform record backs one workout only (unique); one record per provider per workout. Summaries only: no raw samples, no routes | Owner reads; written by `attach_workout_evidence()` only |
| `challenges` | ✅ | Official weekly challenge templates: `kind` (`individual_tiered`, `squad_participation`), title, description, `config` (tiers / squad rule), first and last week, sort order. Seeded: `weekly-tiers-v1`, `squad-week-v1`. A joined challenge's rules cannot be edited (trigger `challenge_locked`); a change is a new row | Read: signed in. Changed by migrations only |
| `challenge_participants` | ✅ | One athlete in one week (Monday, home time zone) of one challenge: week span locked at join, `joined_at`, squad at join, and server-computed progress (`accepted_workouts`, `distance_m` (validated metres per distance goal, e.g. `{"run": 12000, "walk_hike": 31000}`), `tier`) | Owner reads; written only by `join_challenge()` and the evaluator |
| `challenge_awards` | ✅ | Each tier a participant reached (unique per participant + tier), with its value and rule version. It is the `source_id` of the `points_ledger` rows (`source_type = 'challenge'`) that pay it | Owner reads; written by the evaluator only |
| `season_champions` | 📝 | Archived top squads per city per season | Read: signed in |
| `seasons` | — | Not a table: a season is a calendar year (the athlete's home-timezone year, stored on each ledger row). `season_window(year)` gives the part that has elapsed | — |
| `season_standings` | ✅ (functions) | Not stored: derived from the ledger on request. `squad_standings(season, scope, max_rows)` ranks **squads only** by the plain total of points earned in them, for scope `city`, `country` or `world` (centred on the caller's squad's city, or their own). Ranked from 4 current members; smaller squads are listed with points and no rank. Always includes the caller's squad. `my_season_points(season)` is the athlete's own total; `my_standings_place()` their city and country. No individual ranking exists. Materialize per season if this gets slow | Signed-in users (squad totals, names and cities only; the ledger stays owner-only) |
| `squad_messages` | 📝 | Basic squad chat | Squad members |
| `entitlements` | 📝 | Pro status from RevenueCat webhook | Owner reads; server writes |
| `deployment_environment` | ✅ | One row naming the environment (`local`, `staging`, `production`), set once by an operator. Operator scripts check it, e.g. the staging demo data refuses to run elsewhere | No access for app users |
| `onboarding_flows` | ✅ | Versioned onboarding config (steps, types, branches, layouts, profile-field mapping); one active. v3 (active) = the 15-screen flow that runs **before sign-up** (account on screen 14, Pro offer on 15; copy from the design handoff doc). Answers stay on the phone until sign-up, then `complete_onboarding()` saves them; time zone comes from the phone. v1/v2 kept for history. Structure validated by `onboardingFlowSchema` (packages/shared), which a unit test runs against the migration | Read: signed in (all versions); visitors (`anon`) the active flow only; changed by migrations only |

## Squad functions (the app's API)

`create_squad(name, city_id, description)` (max 3 per 30 days) · `preview_squad(code)` · `request_to_join(code, note?)` · `squad_join_request_details(squad)` (captain only: name, note, city, member since, this season's accepted workouts and points) ·
`cancel_join_request(id)` · `decide_join_request(id, approve)` (captain) · `leave_squad()` ·
`remove_squad_member(user)` (captain) · `transfer_captaincy(user)` (captain) · `regenerate_invite_code()` (captain).
When a captain leaves, the longest-standing member becomes captain; when the last member leaves, the squad is
archived. Errors are stable codes (`already_in_squad`, `squad_full`, `invalid_invite_code`, …) the app maps to text.

## Workout functions

`start_workout(client_session_id, activity, client_started_at, device_id)` · `pause_workout` / `resume_workout` /
`finish_workout` / `cancel_workout(session_id, expected_version, client_event_id, client_at, device_id)` ·
`get_open_workout()` · `log_strength_set(...)` · `delete_strength_set(...)`. Every call is idempotent on its client
id and version-checked. Client times are clamped to `[previous event, now]` (start: not more than 12 h ago) and
flagged `offline` when more than 60 s from server time. Errors: `active_workout_exists`, `version_conflict`,
`invalid_transition`, `workout_not_found`, `timezone_required`, `invalid_activity`, `set_window_closed`.
Open workouts past 12 h are expired lazily (on the athlete's next call); a scheduled job can be added later.

## Tracking functions

`add_route_points(session_id, points)` (≤ 500 per call, ≤ 60 000 per workout) · `add_motion_samples(session_id, samples)`
(≤ 750 per call). Both accept measurements while the workout is open and up to 24 h after the finish (the
late-evidence window); cancelled and expired workouts accept nothing. Readings outside the workout's time span
are ignored. Errors: `workout_not_found`, `tracking_window_closed`, `location_not_used`, `invalid_points`,
`too_many_points`, `invalid_samples`.

The phone never uploads a distance. `refresh_workout_metrics()` (internal) computes it: only fixes taken while the
timer was running, not mocked, accuracy ≤ 30 m; a fix counts once it is ≥ 5 m from the last counted one; a jump
faster than 12.5 m/s (25 m/s for rides) is left out and recorded in `gps_excluded_m`; nothing is measured across
a pause. Coverage is the share of active time with good fixes ≤ 30 s apart. The same rules run on the phone for
the live number (`apps/mobile/src/features/workout/tracking/track.ts`); an integration test checks that both
agree. Thresholds are provisional until the device check results are in.

## Evidence function

`attach_workout_evidence(session_id, evidence)`: only after the finish and within 24 h. Refuses hand-typed records
(`manual_record`), Squad Six's own records (`own_record`), records that don't overlap (`no_overlap`), a record
already backing another workout (`evidence_already_used`) and a second record for the same workout
(`evidence_already_attached`); a retry returns the stored row. The server computes `overlap` (share of the
workout, start to finish, that the record covers) and adds the summary to `workout_metrics` with the provider
as `source` and provenance `synced` (`platform_overlap`, `distance_m`, `active_energy_kcal`, `avg_heart_rate`,
`max_heart_rate`, `hr_coverage`). Other errors: `workout_not_finished`, `evidence_window_closed`, `invalid_evidence`.
Whether evidence earns anything (the 80 % overlap rule and so on) is decided by the scoring engine, not here.

## Scoring functions (internal)

None are callable by app users. `score_day(user, date)` re-scores one athlete's day and is idempotent; it is run
by deferred triggers when a workout is finished and when its metrics or evidence change. `workout_scoring_facts()`
decides which evidence categories pass; `scoring_performance()` computes effort and intensity from the rule
config. `set_scoring_active(version, from)` switches a rule version on. Details and known gaps:
[`scoring-proposal.md` §9](scoring-proposal.md).

## Challenge functions

`join_challenge(challenge, week)` (`week` = `current` or `next`): joins this week during its first 25 % (Monday 00:00
to Tuesday 18:00 in the home time zone) or next week any time; idempotent; at most 3 per week. Errors:
`join_window_closed`, `too_many_challenges`, `not_in_squad`, `joined_squad_mid_week`, `timezone_required`,
`challenge_not_running`, `challenge_not_found`, `invalid_week`. `my_challenges()`: this week's challenges with join
state, progress, tier, points paid (from the ledger) and, for the squad challenge, roster / needed / done.

Internal (not callable by app users): `challenge_evaluate(user, date)` runs inside `score_day()` (which is now
`score_workouts_of_day()` followed by it), so it runs on finish, on late evidence and on `review_workout()`.
`challenge_reconcile()` brings one athlete-week's challenge ledger rows in line with the facts (award / top-up /
reversal, weekly cap 250). `challenge_join_at()` is the join rule with the time passed in (for tests). Details:
[`scoring-proposal.md` §10](scoring-proposal.md).

## Account functions

`delete_my_account()`: deletes the caller's auth user and, by cascade, profile, private settings, squad memberships,
join requests, workouts and everything attached to them. Leaves the squad first (captaincy passes on, an empty
squad is archived). Ledger rows stay for the squad with `user_id` set to null. Settings also use the existing
grants (`profiles.display_name`, `profiles.city_id`, `profile_private.weekly_commitment`) and `set_home_timezone()`.

## Squad activity

`squad_activity(days, max_rows)`: the caller's current squad's finished workouts from the last `days` (default 14):
member name, activity, day, end time, active minutes, scoring outcome and points. Current members only. Never any
route, distance or health data. Workouts themselves stay owner-only; this function is the only way teammates see them.

`squad_week_goals()`: for the caller and the current members of their squad (just the caller without a squad):
display name, weekly goal (`profile_private.weekly_commitment`, null if never set) and days trained this week.
A day counts once it has a finished workout (`submitted`, `accepted` or `needs_review`); weeks run Monday to Sunday
in each member's home time zone; a changed goal applies to the current week. Goals are always shared with the squad
(Caleb, 2026-11-19), never with other squads. Counts only: no workout details, location or health data. Earns and
costs no points.

## Rules for every migration

1. Create the table, enable RLS and add policies **in the same migration**.
2. Add a pgTAP test for each policy (allowed and denied).
3. Users never write points, scores, streaks, roles or verification fields. Revoke column privileges and
   write those through functions. Test that a direct `update` is refused.
4. Additive and safe on a populated database. Never edit a merged migration (the CI guard enforces this).
5. Functions use `set search_path = ''`; `security definer` only when needed, and they check `auth.uid()`.
6. Money is integer cents, times are `timestamptz`, durations are seconds, ids are `uuid`.
7. After schema changes, run `pnpm db:types` and commit the generated types.

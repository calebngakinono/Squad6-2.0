# Database schema

Revised 2026-11-10 for Squad Six. ✅ migrated · 🔁 migrated, to be reshaped · 📝 planned (added in the
migration for the feature that needs it). The migration is the source of truth; columns here are indicative.

| Table | Status | Purpose | Access |
|---|---|---|---|
| `profiles` | ✅ | **Public** profile, 1:1 with `auth.users`, created by the signup trigger: display name, city (avatar later). Wrench `experience_level` removed 2026-11-11 (approved). | Signed-in users read; owner updates `display_name`, `city` only (column grants) |
| `profile_private` | ✅ | Home timezone (set only via `set_home_timezone()`: valid IANA name, at most one change per 7 days), personal weekly commitment (not scored), onboarding progress (`onboarding_flow_version`, `onboarding_step`, `onboarding_answers` ≤ 16 KB: goal, experience, activities, wearables) and completion | Owner only; owner updates `weekly_commitment`; progress via `save_onboarding_progress()`, completion via `complete_onboarding()` |
| `squads` | ✅ | Name, city, description, created_by, archived_at (set when the last member leaves) | Signed-in read; writes via functions only |
| `squad_members` | ✅ | Membership **history**: squad, user, role, joined_at, left_at, left_reason. One active squad per athlete, one captain per squad (unique indexes). Max six, enforced by locking the squad row on approval (race-tested) | Squadmates and self read; writes via functions only |
| `squad_invite_codes` | ✅ | One 8-character code per squad (no look-alike characters); captain can regenerate | Active members read |
| `squad_join_requests` | ✅ | pending → approved / declined / cancelled / expired. Max 3 pending per athlete; joining a squad cancels the others | Requester and captain read; writes via functions only |
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
| `challenges` | 📝 | Official challenge definition: type, tiers, evidence requirement, window, rule version (locked once started) | Read: signed in |
| `challenge_participants` | 📝 | Athlete or squad enrollment and progress | Owner / squad members |
| `challenge_awards` | 📝 | Tier awarded; unique per challenge + participant + tier; mirrored as ledger rows | Owner / squad members |
| `season_champions` | 📝 | Archived top squads per city per season | Read: signed in |
| `seasons` | — | Not a table: a season is a calendar year (the athlete's home-timezone year, stored on each ledger row). `season_window(year)` gives the part that has elapsed | — |
| `season_standings` | ✅ (functions) | Not stored: `athlete_standings(season, city, max_rows)` and `squad_standings(season, city, max_rows)` derive standings from the ledger on request. Athletes rank by total points. Squads rank by points ÷ member-seasons (each member's days in the squad ÷ days elapsed), need 3 current members to be ranked, and keep the points earned in them. Both always include the caller's own row. Materialize per season if this gets slow | Signed-in users (totals, names and cities only; the ledger stays owner-only) |
| `squad_messages` | 📝 | Basic squad chat | Squad members |
| `entitlements` | 📝 | Pro status from RevenueCat webhook | Owner reads; server writes |
| `onboarding_flows` | ✅ | Versioned onboarding config (steps, types, branches, profile-field mapping); one active. v1 = core questions, placeholder copy. Structure validated by `onboardingFlowSchema` (packages/shared), which a unit test runs against the migration | Read: signed in; changed by migrations only |

## Squad functions (the app's API)

`create_squad(name, city, description)` (max 3 per 30 days) · `preview_squad(code)` · `request_to_join(code)` ·
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

## Rules for every migration

1. Create the table, enable RLS and add policies **in the same migration**.
2. Add a pgTAP test for each policy (allowed and denied).
3. Users never write points, scores, streaks, roles or verification fields. Revoke column privileges and
   write those through functions. Test that a direct `update` is refused.
4. Additive and safe on a populated database. Never edit a merged migration (the CI guard enforces this).
5. Functions use `set search_path = ''`; `security definer` only when needed, and they check `auth.uid()`.
6. Money is integer cents, times are `timestamptz`, durations are seconds, ids are `uuid`.
7. After schema changes, run `pnpm db:types` and commit the generated types.

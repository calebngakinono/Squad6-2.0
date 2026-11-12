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
| `scoring_rule_versions` | 📝 | Versioned scoring config | Read: signed in. Write: migrations only |
| `points_ledger` | 📝 | Append-only point awards and reversals; unique per source + rule version | Owner reads own; squad/leaderboards via views |
| `workout_evidence` | 📝 | Normalized evidence per session: provider, category, coverage, provenance, `external_record_id` (unique: one platform workout can back only one session) | Owner only; server validates |
| `challenges` | 📝 | Official challenge definition: type, tiers, evidence requirement, window, rule version (locked once started) | Read: signed in |
| `challenge_participants` | 📝 | Athlete or squad enrollment and progress | Owner / squad members |
| `challenge_awards` | 📝 | Tier awarded; unique per challenge + participant + tier; mirrored as ledger rows | Owner / squad members |
| `season_champions` | 📝 | Archived top squads per city per season | Read: signed in |
| `seasons` | 📝 | Year, start, end, status (active / archived) | Read: signed in |
| `season_standings` | 📝 | Derived athlete / squad / city totals per season. Squads rank by average per member (seats weighted by days in squad; 3 members minimum to rank) | Read: signed in |
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

## Rules for every migration

1. Create the table, enable RLS and add policies **in the same migration**.
2. Add a pgTAP test for each policy (allowed and denied).
3. Users never write points, scores, streaks, roles or verification fields. Revoke column privileges and
   write those through functions. Test that a direct `update` is refused.
4. Additive and safe on a populated database. Never edit a merged migration (the CI guard enforces this).
5. Functions use `set search_path = ''`; `security definer` only when needed, and they check `auth.uid()`.
6. Money is integer cents, times are `timestamptz`, durations are seconds, ids are `uuid`.
7. After schema changes, run `pnpm db:types` and commit the generated types.

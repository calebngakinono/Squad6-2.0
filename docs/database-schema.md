# Database schema

Revised 2026-11-10 for Squad Six. ✅ migrated · 🔁 migrated, to be reshaped · 📝 planned (added in the
migration for the feature that needs it). The migration is the source of truth; columns here are indicative.

| Table | Status | Purpose | Access |
|---|---|---|---|
| `profiles` | 🔁 | 1:1 with `auth.users`, created by the signup trigger. Becomes the **public** profile: display name, avatar, city. The Wrench `experience_level` column is removed by a reviewed migration. | Signed-in users read; owner updates allowed columns only |
| `profile_private` | 📝 | Home timezone, goals, weekly commitment, optional measurements, onboarding progress, wearable ownership | Owner only |
| `squads` | 📝 | Name, city, description, created_by, invite code | Signed-in read; writes via functions |
| `squad_members` | 📝 | Squad, user, role (captain / member), joined_at. Max six, enforced with a lock | Members read; writes via functions |
| `squad_join_requests` | 📝 | Pending requests and approvals | Requester and captain |
| `workout_sessions` | 📝 | Live session state machine (see architecture.md) | Owner full; squad sees summary only |
| `workout_session_events` | 📝 | Append-only start/pause/resume/finish log | Owner read; written by functions |
| `workout_metrics` | 📝 | Measurement with `source` and `provenance` | Owner only (location never shared) |
| `strength_sets` | 📝 | Exercise, reps, weight (manual) | Owner; squad sees summary only |
| `scoring_rule_versions` | 📝 | Versioned scoring config | Read: signed in. Write: migrations only |
| `points_ledger` | 📝 | Append-only point awards and reversals; unique per source + rule version | Owner reads own; squad/leaderboards via views |
| `seasons` | 📝 | Year, start, end, status (active / archived) | Read: signed in |
| `season_standings` | 📝 | Derived athlete / squad / city totals per season | Read: signed in |
| `squad_messages` | 📝 | Basic squad chat | Squad members |
| `entitlements` | 📝 | Pro status from RevenueCat webhook | Owner reads; server writes |
| `onboarding_flows` | 📝 | Versioned onboarding configuration (screens, branches) | Read: signed in |

## Rules for every migration

1. Create the table, enable RLS and add policies **in the same migration**.
2. Add a pgTAP test for each policy (allowed and denied).
3. Users never write points, scores, streaks, roles or verification fields. Revoke column privileges and
   write those through functions. Test that a direct `update` is refused.
4. Additive and safe on a populated database. Never edit a merged migration (the CI guard enforces this).
5. Functions use `set search_path = ''`; `security definer` only when needed, and they check `auth.uid()`.
6. Money is integer cents, times are `timestamptz`, durations are seconds, ids are `uuid`.
7. After schema changes, run `pnpm db:types` and commit the generated types.

# Architecture

Revised 2026-11-10 for the Squad Six pivot. Status: **proposed — approved when the pivot PR merges.**

## The short version

- A **mobile app** (Expo) is the product. A **Next.js web app** is the marketing site plus a few server-only
  endpoints. Both talk to one **Supabase** project per environment.
- **Rules live in Postgres.** Starting a workout, finishing it, scoring it and joining a squad are database
  functions that run inside a transaction. Whatever a client sends, the database decides what is allowed.
  That is what makes points trustworthy without a separate backend server.
- The **existing deploy pipeline stays**: merge to `staging` or `main` → migrations → Railway deploy of the
  web app → health check. Mobile builds go through EAS (Expo's build service).

```
iPhone / Android (Expo app)                    Browser
 ├─ HealthKit / Health Connect (read)           └─ Marketing site
 ├─ GPS, pedometer, BLE heart-rate (optional)            │
 └─ RevenueCat SDK (purchases)                            │
        │ supabase-js: auth, RLS reads, RPC calls          │
        ▼                                                  ▼
 Supabase (Auth, Postgres + RLS, RPC functions)  ◄── Next.js on Railway
        ▲                                          (webhooks, account deletion)
        └──────── RevenueCat webhook ──────────────────────┘
```

| Environment | Branch | Railway (web) | Supabase |
|---|---|---|---|
| local | any | `pnpm dev` | Docker |
| CI | PRs | — | disposable Docker DB |
| staging | `staging` | `staging` env (`web2`) | staging project (dashboard name still `wrench-staging`) |
| production | `main` (after Caleb approves) | `production` env (`web`) | production project (dashboard name still `wrench-prod`) |

## Repository layout

A pnpm workspace:

```
apps/mobile/       Expo app (screens, device integrations, offline queue)
apps/web/          Next.js: marketing site, /api/health, webhooks, account deletion
packages/shared/   Zod schemas, generated DB types, scoring-rule types, design tokens
supabase/          migrations, pgTAP tests (unchanged location: the deploy pipeline depends on it)
```

## Where each kind of logic lives

| Logic | Lives in | Why |
|---|---|---|
| Who can read/write what | RLS policies + column privileges | Enforced for every client |
| Workout state changes, scoring, squad joins | Postgres functions (`security definer`, `search_path = ''`) | Atomic; client cannot skip steps |
| Device data (GPS, HealthKit, Health Connect, BLE) | Mobile app → validated by RPC | Only the phone can read it |
| Anything needing a secret or a webhook | Next.js Route Handlers | Secrets stay on the server |
| Scheduled jobs (expire stale sessions, season rollover) | `pg_cron` | No extra service to run |

## Live workout session engine

### States

```
            pause            finish
 active ─────────► paused ─────────► submitted ──► accepted
   ▲  ◄─────────     │                    │    └─► needs_review ──► accepted | rejected
   │    resume       │ finish             └──────► rejected
   │                 ▼
   └──── (no activity for N hours) ──► expired      cancel ──► abandoned
```

Every transition is one database function (`start_workout`, `pause_workout`, `resume_workout`,
`finish_workout`, `cancel_workout`). Each checks the current state and the session's `version`, so a stale
or out-of-order request is refused instead of corrupting the session.

### Tables (indicative)

- `workout_sessions`: id, user, activity type, `state`, `version`, server `started_at` / `ended_at`,
  `client_session_id`, computed active seconds, evidence summary, scoring-rule version.
  - **One active session per user**: a partial unique index on `(user_id) where state in ('active','paused')`.
  - **Idempotent start**: unique `(user_id, client_session_id)`. A retried "Start" returns the same session.
- `workout_session_events`: append-only log of start / pause / resume / finish with server time, client
  time and an `offline` flag. Active time is computed on the server from this log.
- `workout_metrics`: one row per measurement with `source` (gps, healthkit, health_connect, ble_hr,
  pedometer, manual) and `provenance` (`live`, `synced`, `manual`, `estimated`).
- `strength_sets`: exercise, set number, reps, weight (manual, labeled as such).

### Failure handling

| Situation | Behavior |
|---|---|
| App killed or phone restarts | On launch the app asks for the user's active session and resumes the screen. |
| No network mid-workout | Every action becomes a command with its own id in an on-device queue (`expo-sqlite` key-value store, `apps/mobile/src/features/workout/queue.ts`), sent in order when online. The server clamps times to `[previous event, now]` and marks them `offline`. A version conflict refreshes and retries once; a refusal drops the command and rebuilds the local timeline from the server's event log. |
| Duplicate request (retry, double tap) | Same `client_session_id` / event id → same result, no second row. |
| Session forgotten | `pg_cron` moves sessions with no activity for N hours to `expired` (not scored, or scored with capped duration — a scoring-rules decision). |

A running timer alone never proves activity. It is the weakest evidence level.

## Tracking and evidence

Evidence decides **whether a workout is accepted** and sets a small **verification bonus** (0–30). The bonus
counts independent evidence *categories* (location, motion, heart rate, platform record, live set log, later
camera), never device brands, so phone-only users can reach most of it. Details and simulations:
[`scoring-proposal.md`](scoring-proposal.md). Platform specifics: [`health-integrations.md`](health-integrations.md).

| Source | Live? | MVP |
|---|---|---|
| Timer (server start/finish) | yes | ✅ always recorded; weakest evidence |
| Phone GPS (run, walk, cycle, hike) | yes | ✅ with permission; Android needs a foreground-service notification |
| Pedometer (steps) | near-live | ✅ steps only; rep counting from motion is not reliable |
| Strength set/rep logging | manual | ✅ labeled manual |
| HealthKit (iPhone) | **no**, after sync | ✅ after finish, look for an overlapping workout recorded by Apple Watch, Garmin, Strava etc. and attach it as evidence |
| Health Connect (Android) | **no**, after sync | ✅ same matching approach |
| Bluetooth heart-rate strap | yes | stretch: standard BLE heart-rate profile (cheap path to the HR evidence category) |
| Apple Watch / Wear OS live data | yes | ❌ later: needs a native watch app |
| Garmin / Fitbit / Whoop / Oura / Polar cloud APIs | no | ❌ later: partner approval and webhooks |
| Live camera verification | — | ❌ deferred: privacy cost, weak reliability |

The exact capabilities are confirmed by a device spike in phase 1 before being relied on.

### Phone GPS and steps (built)

- **Only while the timer runs.** Location and the step counter start with the workout, stop on pause and at
  the end. Location is requested as "While Using the App" only; because the athlete starts the workout in the
  foreground it keeps recording with the screen locked (iOS background location mode, Android foreground-service
  notification). No "Always" permission is requested.
- **Buffered on the phone, uploaded in batches.** Readings go into a small on-device SQLite file first, then to
  `add_route_points` / `add_motion_samples` every 30 s and at the finish. No signal means they wait; re-sending is
  harmless. The buffer is deleted when the workout is closed on the phone.
- **The server does the maths.** The phone uploads raw fixes and steps per minute, never a distance. The server
  computes `workout_metrics` (distance, coverage, steps) at finish and again when late readings arrive. The live
  screen shows the phone's own running number, labeled as live, and switches to the server's once it is in.
- **Steps:** iPhone reads finished minutes from the phone's step history (covers a locked screen). Android only
  reports steps while the app is running, which is the case for GPS workouts (foreground service) but not
  guaranteed for indoor ones. Motion intensity from the accelerometer (yoga, strength) is not built yet.
- **Not verified on a real device yet**: see [`device-spike.md`](device-spike.md). Accuracy and jitter thresholds
  are provisional until those results are in.

## Scoring engine

- `scoring_rule_versions`: versioned JSON config (base, verification table, activity-specific performance
  ramps and caps, eligibility minimums, daily schedule, merge rule). Only one version is active; changing rules
  means a new version. Approved values are in [`scoring-proposal.md`](scoring-proposal.md); §9 there lists what the
  engine covers today. Scoring is off until `set_scoring_active()` is run for an environment.
- `points_ledger`: append-only. Every row references a session (or other source) and a rule version, and a
  unique key `(source_type, source_id, rule_version, kind, revision)` makes double-awarding impossible (one
  `award` per source and version; each correction is a numbered `adjustment` row, never an edit).
- Athlete, squad and city totals are derived from the ledger (materialized per season), never stored as an
  editable number on a profile.
- Seasons run January 1 – December 31 **in the user's home timezone, locked at the moment a session starts**.
  Daily caps use the same rule.
- Approved formula (rule v1, 2026-11-10, see scoring-proposal.md): `Base 170 (eligible only) + Verification 0–30 + Performance 0–50`, maximum
  250. Weekly-goal points were dropped on 2026-11-10. Switching on production competitive scoring still needs
  Caleb's sign-off at release.
- **Challenges** (`challenges`, `challenge_participants`, `challenge_awards`): official, versioned, locked once
  started, open to Free and Pro equally. Awards are ledger rows with a unique key per challenge, participant and
  tier. Pro custom challenges never award competitive points.
- **Season archive:** standings and champions are frozen per season after a review period.
- **Watch-ready:** session events carry `device_id`, so a future watchOS app uses the same RPCs (see
  `health-integrations.md`).

## Subscriptions (Squad Six Pro)

RevenueCat handles store purchases and restoration. Its webhook hits a Next.js Route Handler that verifies the
request and writes `entitlements` with the server key. Pro features check entitlements **in the database**,
not on the phone. Live purchases stay off until App Store / Play products and sandbox testing are set up.

## Privacy model

- Exact location (GPS tracks, coordinates) is owner-only, always. Teammates and leaderboards see city at most.
- Profiles split into a public part (display name, avatar, city) and a private part (measurements, timezone,
  goals) with separate RLS.
- Users can delete their account; a server endpoint removes their data and auth user.
- Collect only what the feature in use needs. Health data is read only when the user grants permission.

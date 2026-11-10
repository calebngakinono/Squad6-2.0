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

Today the Next.js app sits at the repo root. Phase 1 moves it into a pnpm workspace:

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
| No network mid-workout | Events queue on the phone with client timestamps; on reconnect they are sent in order. The server clamps their times to `[started_at, now]` and marks them `offline`. |
| Duplicate request (retry, double tap) | Same `client_session_id` / event id → same result, no second row. |
| Session forgotten | `pg_cron` moves sessions with no activity for N hours to `expired` (not scored, or scored with capped duration — a scoring-rules decision). |

A running timer alone never proves activity. It is the weakest evidence level.

## Tracking and evidence

Evidence decides **whether a workout is accepted**. It never adds points: an Apple Watch owner and a phone-only
user get the same points for the same accepted workout.

| Source | Live? | MVP |
|---|---|---|
| Timer (server start/finish) | yes | ✅ always recorded; weakest evidence |
| Phone GPS (run, walk, cycle, hike) | yes | ✅ with permission; Android needs a foreground-service notification |
| Pedometer (steps) | near-live | ✅ steps only; rep counting from motion is not reliable |
| Strength set/rep logging | manual | ✅ labeled manual |
| HealthKit (iPhone) | **no**, after sync | ✅ after finish, look for an overlapping workout recorded by Apple Watch, Garmin, Strava etc. and attach it as evidence |
| Health Connect (Android) | **no**, after sync | ✅ same matching approach |
| Bluetooth heart-rate strap | yes | stretch: standard BLE heart-rate profile |
| Apple Watch / Wear OS live data | yes | ❌ later: needs a native watch app |
| Garmin / Fitbit / Whoop / Oura / Polar cloud APIs | no | ❌ later: partner approval and webhooks |
| Live camera verification | — | ❌ deferred: privacy cost, weak reliability |

The exact capabilities are confirmed by a device spike in phase 1 before being relied on.

## Scoring engine

- `scoring_rule_versions`: versioned JSON config (base, duration curve and cap, commitment contribution,
  per-activity eligibility minimums, daily cap). Only one version is active; changing rules means a new version.
- `points_ledger`: append-only. Every row references a session (or other source) and a rule version, and a
  unique key `(source_type, source_id, rule_version, kind)` makes double-awarding impossible. Corrections are
  new negative rows, never edits.
- Athlete, squad and city totals are derived from the ledger (materialized per season), never stored as an
  editable number on a profile.
- Seasons run January 1 – December 31 **in the user's home timezone, locked at the moment a session starts**.
  Daily caps use the same rule.
- Provisional formula (not final): `Base 100 + Duration 0–40 (capped) + Commitment 0–30`. Final rules need
  Caleb's approval before production competitive scoring is switched on.

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

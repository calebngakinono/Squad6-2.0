# MVP plan: Squad Six

Revised 2026-11-10 (pivot from Wrench AI). Target: **2026-12-09**. Status: **proposed**.

> Fitness consistency is easier when five people are counting on you.

## What must work on December 9

One real person on a real iPhone can: sign up → go through onboarding → create or join a squad → start a live
workout → pause, resume, finish (surviving an app restart) → see a transparent point breakdown → see their
squad's standing on the season leaderboard. Teammates see the activity. Nothing on screen is fabricated.

## Scope

| Priority | Feature | By Dec 9 |
|---|---|---|
| 1 | **Live workout sessions**: server state machine, timer, GPS for outdoor activities, set/rep logging, pause/resume, recovery, offline queue | ✅ |
| 2 | **Scoring, ledger, seasons, leaderboards**: versioned rules, no double awards, athlete/squad/city standings, year selector | ✅ (rules need approval before production) |
| 3 | **Squads**: create, invite link, join request + approval, max six, roles, member activity, shared weekly commitment | ✅ |
| 4 | **Auth and profiles**: email, Sign in with Apple, Google; public/private profile split; account deletion | ✅ |
| 5 | **Onboarding**: configurable, resumable, branching flow; placeholder screens until the storyboard designs arrive; demo content labeled | ✅ engine + core questions |
| 6 | **HealthKit / Health Connect matching** as evidence | ✅ if the device spike is green |
| 7 | Squad chat (basic) | stretch; activity feed is the fallback |
| 8 | Marketing site (one page) | ✅ small |
| 9 | Pro: entitlements table, server checks, RevenueCat sandbox | stretch; no live purchases |
| Later | Progress Intelligence, Squad Leadership, Athlete Legacy, achievements beyond streaks, BLE heart-rate, watch apps, cloud wearable APIs, camera verification, prize campaigns, organization accounts, sponsored challenges | ❌ documented, not built |

## Schedule

| Week | Work | Done when |
|---|---|---|
| **Nov 10–16** | Phase 1: pivot docs; monorepo (`apps/web`, `apps/mobile`, `packages/shared`); Expo dev build with Supabase auth; schema foundation (profiles split); **device spike** | Staging still deploys; app runs on Caleb's iPhone; spike findings written |
| **Nov 17–23** | Squads (create, invite, join/approve, roles, limit of six) and onboarding engine | Two test accounts form a squad on staging |
| **Nov 24–30** | Live workout engine end-to-end: state machine, GPS, set logging, recovery, offline queue; health-platform matching if spike is green | Kill-the-app and airplane-mode tests pass on device |
| **Dec 1–5** | Scoring rules (approved), ledger, season standings, leaderboards, activity feed; marketing page | Point breakdown shown and traceable to ledger rows |
| **Dec 6** | **Feature freeze**: cut anything not solid | — |
| Dec 7–9 | Hardening, E2E and pgTAP coverage, production release (approved), TestFlight build, demo script, honest completion report | Prod live; TestFlight build installed |

**If time runs short, cut in this order:** chat → Pro sandbox → health-platform matching → marketing polish.
The workout session, scoring and squads stay.

## External blockers to track

| Blocker | Needed for | Status |
|---|---|---|
| Apple Developer Program membership | EAS iOS builds on device, TestFlight, Sign in with Apple, HealthKit entitlement | Caleb enrolling |
| Android test device | Health Connect, Android GPS foreground service | Caleb getting one |
| Onboarding storyboard designs (Fiverr designer) | Final onboarding screens and visual design | Placeholders until delivered |
| App Store / Play subscription products | Live Pro purchases | Not before release |
| Scoring-rules approval | Production competitive scoring | Proposal due in week 4 |

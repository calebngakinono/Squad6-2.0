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
| 1 | **Live workout sessions**: server state machine, timer, GPS for outdoor activities, set/rep logging, pause/resume, recovery, offline queue, device-neutral events (watch-ready) | ✅ |
| 2 | **Scoring, ledger, seasons, leaderboards**: Base + Verification + Performance ([proposal](scoring-proposal.md)), daily rules, no double awards, transparent workout summary, squad standings by city / country / world (no individual ranking; each athlete sees their own season total), year selector | ✅ (rules approved; production switch-on needs sign-off) |
| 3 | **HealthKit evidence** (post-workout matching, provider-independent design) | ✅ high priority |
| 3 | **Health Connect evidence** | ✅ once the Android device arrives; otherwise first item after Dec 9 |
| 4 | **Squads**: create, invite link, join request + approval, max six, roles, member activity | ✅ |
| 5 | **Challenges (official)**: individual tiered and squad participation challenges, evidence requirements, awards in the ledger, history | ✅ core types; ranked city events and seasonal events are stretch |
| 6 | **Auth and profiles**: email, Sign in with Apple, Google; public/private profile split; account deletion | ✅ |
| 7 | **Onboarding**: configurable, resumable, branching flow; placeholder screens until the storyboard designs arrive; demo content labeled | ✅ engine + core questions |
| 8 | Squad chat (basic) | stretch; activity feed is the fallback |
| 9 | Marketing site (one page) | ✅ small |
| 10 | Pro: entitlements table, server checks, RevenueCat sandbox | stretch; no live purchases |
| Later | Progress Intelligence, Squad Leadership, Athlete Legacy, achievements beyond streaks, BLE heart-rate, watchOS app, cloud wearable APIs, camera verification, season prizes and monthly drawings (need funding and legal review), organization accounts, sponsored challenges | ❌ documented, not built |

## Schedule

| Week | Work | Done when |
|---|---|---|
| **Nov 10–16** | Phase 1: pivot docs; monorepo (`apps/web`, `apps/mobile`, `packages/shared`); Expo dev build with Supabase auth; schema foundation (profiles split); **device spike** | Staging still deploys; app runs on Caleb's iPhone; spike findings written |
| **Nov 17–23** | Squads (create, invite, join/approve, roles, limit of six), onboarding engine; (scoring rules approved Nov 10) | Two test accounts form a squad on staging |
| **Nov 24–30** | Live workout engine end-to-end: state machine, GPS, set logging, recovery, offline queue; evidence providers + HealthKit matching | Kill-the-app and airplane-mode tests pass on device; an Apple Health workout attaches as evidence |
| **Dec 1–5** | Scoring engine from approved rules, ledger, workout summary, season standings, leaderboards; official challenges (core types); marketing page | Every point on the summary traces to ledger rows; simulation scenarios pass as tests |
| **Dec 6** | **Feature freeze**: cut anything not solid | — |
| Dec 7–9 | Hardening, E2E and pgTAP coverage, production release (approved), TestFlight build, demo script, honest completion report | Prod live; TestFlight build installed |

**If time runs short, cut in this order:** chat → Pro sandbox → ranked/seasonal events → marketing polish →
squad challenges. The workout session, scoring, HealthKit evidence, squads and individual challenges stay.

## External blockers to track

| Blocker | Needed for | Status |
|---|---|---|
| Apple Developer Program membership | EAS iOS builds on device, TestFlight, Sign in with Apple, HealthKit entitlement | Caleb enrolling |
| Android test device | Health Connect, Android GPS foreground service | Caleb getting one |
| Onboarding storyboard designs (Fiverr designer) | Final onboarding screens and visual design | Placeholders until delivered |
| App Store / Play subscription products | Live Pro purchases | Not before release |
| Scoring-rules approval | Building the scoring engine (week 3) | ✅ Approved 2026-11-10: [scoring-proposal.md](scoring-proposal.md) |
| Google Play health-permissions review | Health Connect in a Play release | Not needed for internal testing |
| Legal review, funding, official rules | Any prize or drawing | Not before launch |

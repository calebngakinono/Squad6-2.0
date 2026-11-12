# Scoring proposal

Status: **APPROVED by Caleb on 2026-11-10** (all decisions in §8). This is rule version `v1` for the scoring
engine. The engine core is built (see §9 for what it covers and where it differs from the tables below).
Production competitive scoring still needs Caleb's sign-off at release; scoring is switched off by default.
Every number below comes from `node scripts/scoring-simulation.mjs`; any later change becomes a new rule version.

## 1. Formula

```
Workout PTS = Base (170, only if eligible) + Verification (0–30) + Performance (0–50)
Performance = Effort (0–30, same for every activity) + Intensity (0–20, activity-specific)
```

Maximum regular workout: **250**. Weekly-goal points are **removed** (per the 2026-11-10 decision).

### 1.1 Eligibility (all required for the 170 base)

| Rule | Value (proposed) |
|---|---|
| Session finished through the server state machine (not expired, not abandoned) | required |
| Active time (pauses excluded, computed on the server) | ≥ 20 min (HIIT ≥ 15 min) |
| At least one corroborating evidence category (below) covering ≥ 50 % of active time | required |
| Plausibility checks pass (speed, GPS jumps, HR range, overlap) | otherwise `needs_review` |
| Not merged into a previous session, within the daily limit | see §3 |

A timer with nothing else is **recorded** (history only) and earns **0** competitive points.

### 1.2 Verification bonus (0–30): count independent evidence *categories*, not devices

| Category | Passes when | Who can get it without a wearable |
|---|---|---|
| Location | GPS track covers ≥ 70 % of active time, plausible speeds, no mock-location flag | Everyone outdoors |
| Motion | Phone or watch motion (cadence / accelerometer) matches the activity for ≥ 60 % of active time | Phone in pocket or armband |
| Heart rate | HR samples cover ≥ 70 % of active time, values vary plausibly (not constant) | $30–50 Bluetooth chest strap |
| Platform record | A HealthKit / Health Connect workout overlaps ≥ 80 %, was **auto-recorded** (not typed in by hand), comes from another app, and is not attached to any other session | Workouts recorded by other apps on the phone |
| Live set log | Strength sets logged *during* the session that pass the checks in §1.2.1 (**approved**) | Everyone lifting |
| Visual (future) | In-app live camera check passes | Everyone (deferred) |

| Categories | 0 | 1 | 2 | 3+ |
|---|---|---|---|---|
| Bonus | 0 | 15 | 25 | 30 |

#### 1.2.1 Live set log: how it proves the work happened

A set log only counts if it looks like it was recorded while lifting, not typed in afterwards. The app makes
this the natural way to log: each set has a **Done** button that records the set and starts the rest timer.

| Check | Rule (proposal) | What it catches |
|---|---|---|
| Logged live | Each set's time comes from the server when it arrives (offline sets keep the device time, clamped to the session and flagged). Sets added after Finish are saved but do not count as evidence | Typing the whole workout in at the end |
| Enough sets | At least 6 sets | A token entry |
| Spread out | Sets cover at least 60 % of active time (first to last set) | Logging everything in the first minute |
| Rest gaps | Most gaps between sets are 20 s to 10 min; no more than 3 sets inside any 60 s | Bulk entry, fake rhythm |
| Set details | Exercise and reps on every set; weight optional and never scored | Empty taps |
| Motion during sets (optional) | If the phone is on the body, movement spikes near each Done tap | Strengthens the log; also counts as the separate Motion category if it passes that check |
| Patterns over time | Identical logs repeated across sessions, or impossible volume, go to review | Copy-paste farming |

A log that fails these checks is kept as the athlete's record; it just doesn't count as evidence. The athlete
sees why ("sets were logged too close together to count as live").

Brand never matters: an Apple Watch, a Garmin and a chest strap are judged on the same data-quality checks.
The diminishing scale (15 → 25 → 30) keeps the wearable advantage small.

### 1.3 Performance bonus (0–50)

**Effort (0–30)** is identical for every activity: active minutes ramp from 20 to 60. Nothing beyond 60 minutes
counts. This is what keeps any one activity from dominating.

**Intensity (0–20)** uses only validated measurements, each with a capped ramp:

| Activity | Intensity measure | 0 at | 20 at |
|---|---|---|---|
| Run | Pace from validated distance (≥ 2 km) | 8:00 /km | 4:30 /km |
| Walk / hike | Effort-km per hour (100 m climb ≈ 1 km) | 4 km/h | 7 km/h |
| Cycle | Average speed from validated distance | 15 km/h | 32 km/h |
| Swim | Pace per 100 m (needs platform distance) | 3:30 | 1:45 |
| Strength | Working sets logged live | 8 sets | 24 sets |
| HIIT, classes, yoga, indoor cardio | Vigorous minutes: HR at 77–95 % of estimated max **or** motion intensity | 5 min | 25 min |

Safety rules: minutes above 95 % of estimated max HR never count; duration stops counting at 60 minutes;
weight lifted is **not** used (self-reported and favors heavier athletes); calories are never used.

## 2. Simulation (rule v1)

| # | Scenario | Status | Base | Verif | Perf | **Total** | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Phone-only 5 km run, 30 min | accepted | 170 | 25 | 19 | **214** | location+motion |
| 1b | Fast runner, phone-only 10 km in 42 min | accepted | 170 | 25 | 37 | **232** | location+motion |
| 2 | Apple Watch 10 km run, 55 min | accepted | 170 | 30 | 41 | **241** | 4 categories |
| 3 | Treadmill 40 min, phone in pocket | accepted | 170 | 15 | 25 | **210** | motion |
| 4 | Phone-only strength, 50 min, 16 sets | accepted | 170 | 15 | 33 | **218** | live set log |
| 4b | Same + $40 Bluetooth HR strap | accepted | 170 | 25 | 33 | **228** | HR+set log |
| 5 | Watch strength, 60 min, 20 sets | accepted | 170 | 30 | 45 | **245** | 4 categories |
| 6 | Yoga 45 min, phone timer only | recorded | – | – | – | **0** | none |
| 7 | Yoga 60 min with watch | accepted | 170 | 30 | 31 | **231** | 3 categories |
| 7b | Yoga 60 min, phone in pocket | accepted | 170 | 15 | 30 | **215** | motion |
| 8 | Phone-only 25 km ride, 60 min | accepted | 170 | 25 | 42 | **237** | location+motion |
| 9 | Phone-only brisk walk 3 km, 30 min | accepted | 170 | 25 | 21 | **216** | location+motion |
| 10 | Hike 8 km + 400 m climb, 150 min | accepted | 170 | 25 | 35 | **230** | location+motion |
| 11 | Watch pool swim 1,500 m, 40 min | accepted | 170 | 30 | 25 | **225** | 3 categories |
| 12 | HIIT class 35 min, watch | accepted | 170 | 30 | 21 | **221** | 3 categories |
| 12b | Same class, phone in pocket | accepted | 170 | 15 | 18 | **203** | motion |
| 13 | Beginner: 22 min walk, 1.8 km | accepted | 170 | 25 | 8 | **203** | location+motion |
| 14 | ABUSE: 8 h timer, phone on a desk | recorded | – | – | – | **0** | none |
| 15 | ABUSE: "run" at 38 km/h (car) | needs_review | – | – | – | **0** | speed check |
| 16 | ABUSE: hand-typed Health app run | recorded | – | – | – | **0** | user-entered rejected |

### What the numbers say

- **Every eligible workout is worth 203–245.** A beginner's first walk earns 83 % of a maximum workout. The base
  rewards showing up; performance separates athletes by up to about 40 points.
- **Wearable advantage on an identical workout: 0–20 points (up to about 8 %).** Outdoor GPS activities: 5.
  Strength and classes: 15–20, which a $30–50 Bluetooth heart-rate strap, or later the camera check, closes.
- **No activity dominates.** At 60 active minutes every activity starts from the same 30 effort points; the
  20 intensity points are calibrated so a strong recreational athlete reaches about half in any activity.
- **Phone-only yoga with the phone lying still is the hard gap.** It has no evidence and earns 0. With the phone
  in a pocket it earns 215. The camera check is the long-term fix. **Approved: timer-only workouts earn 0** (no self-reported tier).

### Season scale (regular workouts only)

| Profile | Per week | Per season |
|---|---|---|
| Casual: 3/week, phone-only | 651 | 33,852 |
| Regular: 4/week, phone-only | 908 | 47,216 |
| Regular: 4/week, watch | 928 | 48,256 |
| Committed: 5/week, watch | 1,200 | 62,400 |
| Elite: 6/week + 3 two-a-days | 1,839 | 95,628 |

The 170 base is 68–85 % of every workout, so **standings mostly measure how many legitimate workouts a squad
completes.** That fits an accountability product. Challenges (§5) are the main lever for extra separation.

## 3. Multiple workouts per day (approved: option C)

| Option | Daily max | Two-a-day athlete | Farming risk |
|---|---|---|---|
| A. One scored workout per day | 250 | Second session earns 0 | Lowest; discourages legitimate doubles |
| B. Two full workouts per day | 500 | Fully rewarded | Highest; squads of six can double their score with short extra sessions |
| **C. 100 % then 50 %, third+ earns 0** (recommended) | 375 | Rewarded, at a lower rate | Low |

Rules that go with option C:

1. **Merge rule:** a session of the same activity that starts less than 2 hours after the previous one ended is
   merged into it and scored once. This stops splitting one workout into several.
2. **Day** = the user's home-timezone calendar day, locked at session start.
3. The order of a day's workouts is set by start time. If an earlier workout is later rejected, the day is
   re-scored and the ledger records the adjustment.

| Day | Result |
|---|---|
| Run 6 km at 07:00 + strength 45 min at 18:00 (both phone) | 219 + 106 = **325** |
| ABUSE: one 60 min run split into 3 × 20 min sessions, 2 min apart | merged into one: **238** |
| ABUSE: four 25 min walks spread through the day | 207 + 104 + 0 + 0 = **311** |

Optional, not recommended at launch: a weekly cap (e.g. 10 scored workouts). Option C already limits a week to
7 × 375.

## 4. Anti-cheating

| Threat | Protection |
|---|---|
| Timer left running | Evidence required; active time stops counting at 60 min; stale sessions expire |
| Faked or edited timestamps | Server time is authoritative; offline events are clamped to `[start, now]` and flagged |
| Duplicate requests and retries | Idempotent start (`client_session_id`); unique ledger key per session + rule version |
| Splitting or farming | Merge rule, daily schedule (§3), minimum active time |
| Re-using one watch workout | Each HealthKit / Health Connect record id can attach to only one session, for one user |
| Hand-typed platform workouts | HealthKit `wasUserEntered` and Health Connect `recordingMethod = MANUAL_ENTRY` are rejected as evidence |
| Driving or riding as "running" | Per-activity speed limits, GPS jump detection, cadence vs speed consistency |
| Fake GPS apps | Android mock-location flag and iOS simulated-location flag fail the location category |
| Overlapping sessions | One active session per user; a session overlapping another scored session is not scored |
| Unusual patterns | Outliers against the user's own history go to `needs_review`; teammates can flag workouts; corrections are reversing ledger rows |
| Modified clients (later) | App Attest (iOS) and Play Integrity (Android) on scoring RPCs |

No anti-cheat is perfect with phone-only evidence. The design goal is that cheating takes about as much effort
as working out, and that review plus reversals stay possible.

**Late evidence:** Apple Watch and Health Connect data can arrive minutes to hours after a workout. Proposal:
award base and performance at finish, then allow a **24-hour evidence window** in which synced data can raise
the verification bonus once (a separate ledger row). The summary shows "Waiting for Health sync".

## 5. Challenges and events

All official challenges that affect rankings are published by Squad Six, open to Free and Pro equally, and
locked (versioned) once they start. Pro "custom squad challenges" are for fun and never award competitive points.

| Type | Example | Award (proposed) |
|---|---|---|
| Individual tiered (weekly) | Bronze: 3 accepted workouts · Silver: 5 · Gold: 25 km validated run/walk distance | 40 / 80 / 120 (highest tier only) |
| Activity-specific | Weekend distance, strength-set totals | Same tier scale |
| Squad participation (weekly) | At least ⅔ of members (rounded up) each complete 3 accepted workouts | 60 per participating member |
| Squad collective | Squad total of 150 validated km in a week | 60 per contributing member |
| Seasonal / monthly event | Multi-week program, tiered | up to 300 per athlete |
| Ranked city event (limited time) | Top squads in a city by event points | 600 / 400 / 200 to the squad total |

Rules:

- Only accepted workouts that meet the challenge's evidence requirement count. Distance challenges need a
  location or platform-record category, so a manual distance can never complete one.
- Join before the challenge starts or within its first 25 % of time. No retroactive workouts.
- At most 3 active official challenges per athlete. Challenge points are capped at **250 per athlete per week**
  (equal to one maximum workout).
- Squad challenges count members who were in the squad when the challenge started. Changing squads mid-challenge
  forfeits it. Thresholds are proportional, so a squad of four can complete a squad challenge.
- Awards are ledger rows with a unique key `(challenge_id, participant, tier)` and can never be paid twice.

**Scale:** a committed athlete who wins most weekly golds, squad challenges and monthly events earns about
13,000 challenge points, about 20 % on top of 62,400 from workouts. A casual athlete earns about 3,400 (about
10 %). That is meaningful separation for high performers without bronze being out of reach. To make challenges
matter more, raise the tier values; the simulation script is the place to test it.

**Squad standing (approved: average per member, minimum 3):** a squad is ranked by its average points per
member, so an active squad of four competes evenly with an active squad of six.

```
Squad score = points members earned while in the squad ÷ member-seasons
member-seasons = sum of each member's days in the squad ÷ days elapsed in the season
```

- A squad needs **at least 3 members** to appear in squad and city rankings. Smaller squads see their score
  marked "unranked: needs 3 members".
- Seats are counted by time in the squad, so removing a low scorer does **not** erase the days they were there.
  This blocks kicking teammates to raise the average.
- Points stay with the squad where they were earned. An athlete who switches squads does not take them along.
- Example: six members averaging 50,000 and four members averaging 50,000 both score 50,000.
- Squad challenge awards (§5) count toward the squad score the same way as workout points.

## 6. Rewards

**A. Season prizes (top 3 squads per participating city).** These are planned, not promised. A city
participates only when it has enough squads (e.g. 10). There is a 14-day review period after December 31 before
champions are final. Squads with unresolved fraud flags are not eligible. Champions are archived per season.

**B. Monthly drawings (proposal):** one entry per accepted-workout day, up to 12 per month. There is a free
mail-in entry method worth the same maximum. Pro gets no extra entries. Entrants must be 18+ and in an eligible
jurisdiction, and official rules are published. **Requires legal review before launch.** US sweepstakes law
treats "consideration" differently by state, and requiring workouts may count as effort-based consideration,
which is why the free entry method matters. Some states require registration and bonding above certain prize
values. Nothing is advertised until a campaign is funded.

## 7. Implementation notes

- `scoring_rule_versions` stores this whole config (base, verification table, ramps, caps, daily schedule) as
  versioned JSON. Every ledger row references the version that produced it.
- The evaluator runs in Postgres. The workout summary reads the ledger rows, so every number shown can be
  traced to a rule and a workout record.
- The simulation scenarios become pgTAP and Vitest test fixtures, so the engine must reproduce the tables above.

## 8. Decisions (all approved by Caleb, 2026-11-10)

1. ✅ **Approved:** base 170, verification 0/15/25/30, effort 30 + intensity 20, ramps in §1.3.
2. ✅ **Approved:** daily option C (100 % / 50 % / 0, max 375 per day) with the 2-hour merge rule.
3. ✅ **Approved:** live set logs count as evidence, with the checks in §1.2.1.
4. ✅ **Approved:** timer-only workouts earn 0 points until the camera check ships. No self-reported tier.
5. ✅ **Approved:** 24-hour late-evidence window.
6. ✅ **Approved:** challenge values in §5 (tiers 40/80/120 etc.) and the 250-per-week challenge cap.
7. ✅ **Approved:** average per member, minimum 3 members to be ranked, seats weighted by time in squad.

## 9. What the engine implements today (2026-11-11)

Built in `supabase/migrations/20261112030000_scoring_engine.sql`; the scenario tests are
`supabase/tests/scoring.test.sql`. The engine reproduces scenarios 1, 1b, 2, 4, 5, 6, 8, 9, 13, 14, 15 and the three
days in §3 exactly.

**Differences from the tables above, because the data does not exist yet:**

| Gap | Effect | What closes it |
|---|---|---|
| No "vigorous minutes" (needs per-minute heart rate plus age, or accelerometer intensity) | HIIT, yoga, indoor cardio and "other" earn effort points only (performance 0–30 instead of 0–50). Scenarios 3, 7, 7b, 12, 12b score lower than published | Collecting per-minute heart rate or motion intensity |
| No watch motion category (only phone steps count as motion) | A watch-only workout gets heart rate + platform record = 25, not 30. Scenario 11 scores 220, not 225 | A watch app, or reading watch step data from Apple Health |
| No elevation gain | Hikes are scored on flat distance; scenario 10 scores lower | Computing climb from GPS altitude after the device check |
| No Bluetooth heart-rate strap | Scenario 4b cannot happen yet | The BLE stretch item |
| No review tool | A `needs_review` workout stays at 0 points | An admin review flow |

**Values I chose where the proposal gave none (in the v1 config, easy to change before launch):**

- Average-speed limits that send a workout to review: run 25 km/h, walk and hike 12 km/h, ride 60 km/h.
- A GPS track goes to review if more than 20 % of its distance was thrown out as jumps.
- Heart rate counts only if the readings span at least 5 bpm (a constant value is not a heartbeat).

**How the daily rules are applied:**

- Only workouts with evidence are merged, and only into the last such workout of the day (same activity, starting
  less than 2 hours after it ended). An empty session can neither wipe out a real workout nor be slipped between
  two halves to avoid merging. A merged workout keeps an evidence category only if every part has it.
- Workouts that are too short, have no evidence or are in review do not use up one of the day's two paid slots.
- Merging does not cross midnight (each calendar day in the home time zone is scored on its own).

**Mechanics:**

- Scoring runs when a workout is finished and again whenever its measurements or evidence change (late uploads,
  Apple Health sync, both limited to 24 hours). A change produces an `adjustment` ledger row for the difference.
- A workout's lifecycle state stays `submitted`; the scoring outcome (`accepted`, `recorded`, `needs_review`,
  `merged`) and the breakdown live in `workout_scores`.
- **Scoring is off until switched on per environment:** `select public.set_scoring_active('v1', now());` (database
  owner or service role only). Workouts that started before that moment are never scored.

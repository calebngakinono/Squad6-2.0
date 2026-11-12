# Health platform integrations

Revised 2026-11-10. Status: plan. Items marked **(verify)** are confirmed in the phase-1 device spike before
anything depends on them.

## The key fact: "live" vs "after sync"

| Data | Live during the Squad Six session? | How |
|---|---|---|
| Elapsed / active time | ✅ | Our server state machine |
| Phone GPS, pace, distance | ✅ | `expo-location` in the app |
| Phone steps, cadence, motion | ✅ (near-live) | Core Motion / Android sensors |
| Bluetooth heart-rate strap | ✅ | Standard BLE Heart Rate profile |
| Apple Watch HR, energy, distance | ❌ not reliably on the phone **during** the workout without our own watch app | Arrives in HealthKit after the watch syncs |
| Wear OS / Garmin / Fitbit / Samsung data | ❌ | Arrives in Health Connect when the source app writes it (minutes to hours) |

So the live screen shows timer, GPS and motion metrics (plus BLE heart rate if connected). Wearable data is
attached **after** the workout as evidence and shown in the summary, labeled "synced from Apple Health" or
"synced from Health Connect". It is never shown as if it were live.

## Apple HealthKit (iOS)

**Setup:** a paid Apple Developer account (HealthKit entitlement), an Expo development build (not Expo Go), and
a HealthKit library with an Expo config plugin (candidate: `@kingstinct/react-native-healthkit` **(verify)**).
Info.plist needs `NSHealthShareUsageDescription` (and `NSHealthUpdateUsageDescription` if we write workouts).

**Read permissions requested:** workouts, workout routes, heart rate, active energy, distance
(walking/running, cycling, swimming), step count. Request them only when the user turns on the integration,
not at first launch.

**After a workout:**
1. Query `HKWorkout` records overlapping the session interval.
2. Reject any record with `HKMetadataKeyWasUserEntered`, any record whose source is Squad Six itself, and any
   record already attached to another session (unique on the HealthKit UUID).
3. Read the workout's statistics (duration, distance, average/max HR, energy) and optionally its route.
4. Send a normalized evidence bundle to the server (below). Store summaries, not raw sample streams.

Background: `HKObserverQuery` plus background delivery can wake the app when new workouts arrive. iOS decides
how often, so the 24-hour evidence window also re-checks whenever the app opens.

**Limitations:**
- **Apps cannot tell whether read access was denied.** A denied read looks exactly like "no data". The UI says
  "No matching Apple Health workout found", never "You denied access".
- HealthKit data is unavailable while the iPhone is locked, so background queries can fail and must retry.
- Live Apple Watch metrics need a watchOS app (`HKWorkoutSession` + `HKLiveWorkoutBuilder`, mirrored to the
  iPhone on iOS 17+). Newer iOS versions add workout sessions on the iPhone itself **(verify)**.
- App Store rules: health data may not be used for advertising or sold, a privacy policy is required, and
  personal health data must not be stored in iCloud. Our database keeps only derived summaries, with consent.

## Android Health Connect

**Setup:** an Expo development build and a Health Connect library with a config plugin (candidates:
`react-native-health-connect` + `expo-health-connect` **(verify)**). Health Connect is built into Android 14+.
On Android 9–13 the user installs the Health Connect app. The manifest declares each health permission and a
privacy-policy rationale activity.

**Read permissions:** exercise sessions, exercise routes, heart rate, distance, steps, active / total calories.

**After a workout:** read `ExerciseSessionRecord`s overlapping the session and apply the same rejection rules:
- `metadata.recordingMethod = MANUAL_ENTRY` is rejected.
- Our own `dataOrigin` is excluded.
- A record id can be used only once.

Then read the related HR, distance and route data.

**Limitations:**
- Data appears only when the source app (Samsung Health, Fitbit, Garmin Connect, ...) writes it, which ranges
  from minutes to hours.
- By default an app can read only data from up to 30 days before permission was granted. Background reads need
  an extra permission **(verify)**.
- Route access has its own user consent **(verify)**.
- Google Play requires a health-permissions declaration and policy review before release. Budget time for it.

## Provider-independent design

```
Device                                         Server
EvidenceProvider (one per source)              attach_evidence(session_id, bundle)  ← RPC
 ├─ healthkit        ┐                          ├─ Zod/SQL validation, plausibility checks
 ├─ health_connect   ├─► normalized             ├─ evidence rows: source, provenance,
 ├─ phone_gps        │   EvidenceBundle         │  external_record_id (unique), coverage
 ├─ phone_motion     │   (packages/shared)      └─ verification evaluator (versioned) → categories
 ├─ ble_heart_rate   │
 └─ watch_live (later)┘
```

Each provider implements the same small interface: `isAvailable()`, `requestPermissions()`,
`findOverlappingWorkouts(interval)`, `getSummary(interval)` and, for live sources, `subscribe()`. Adding Garmin,
Polar or a camera check later means one new provider and no change to the session engine or scoring.

## What is built (2026-11-11)

Apple Health matching, phone side in `apps/mobile/src/features/workout/evidence/`:

- **Opt-in.** The finished-workout screen offers "Connect Apple Health". Apple's permission sheet is shown only
  then, and only for workouts and heart rate (read-only; nothing is written to Apple Health).
- **Matching.** After the finish the app reads Apple Health workouts around the session, drops hand-typed ones and
  Squad Six's own, picks the one that overlaps most, summarizes heart rate for the shared time, and calls
  `attach_workout_evidence`. The server re-checks everything it can and computes the overlap itself.
- **Late syncs.** Each time the app opens it re-checks workouts finished in the last 24 hours that have no Apple
  Health evidence. Background delivery (`HKObserverQuery`) is not built.
- **Honest labels.** The screen says "Synced from Apple Health after the workout" and, when nothing is found, "No
  matching Apple Health workout found yet" (never "denied": iOS does not tell us).
- **Known limit.** The phone reports what Apple Health says; the server cannot verify HealthKit itself. A modified
  app could send a made-up summary, which is why evidence is a small bonus with plausibility checks, not proof.
- **Not verified on a real iPhone yet** (needs the Apple Developer membership and a development build with the
  HealthKit entitlement): see the checklist in [`device-spike.md`](device-spike.md).
- Health Connect (Android) is not built; it will be a second provider behind the same interface.

## Future Apple Watch app (not started)

The session engine is already device-neutral, so a watch app is another client:

- Every session event carries a `device_id` and a client event id. Start, pause, resume and finish are the same
  RPCs whether they come from the phone or the watch.
- One session, many devices: the version check stops the phone and watch from making conflicting changes.
- Watch metrics arrive with provenance `live` from the `watch_live` provider.
- The watch reaches the server through the phone (WatchConnectivity) or directly over its own network.

Requirements for later: a native Swift watchOS target added to the Expo project (via a config plugin),
`HKWorkoutSession` on the watch, and session mirroring to the phone.

## Privacy

- Ask for health permissions only when the user turns on the integration, and explain each data type.
- Store derived summaries (duration, distance, average HR, coverage %), not raw sample streams. Routes stay
  owner-only.
- Disconnecting an integration stops reads. Account deletion removes all stored health-derived data.

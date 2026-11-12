# Device spike (phase 1)

Goal: measure what a real phone delivers before the workout engine depends on it. Answers the
**(verify)** items in [health-integrations.md](health-integrations.md). Results below stay "pending" until
measured on a device; nothing here is estimated.

## How to run (iPhone)

1. Build and install the development build ([mobile setup](mobile-setup.md)). This build adds native code
   (location, motion, HealthKit), so an older build will not work.
2. Sign in, tap **Device check (dev only)**. The screen exists only in development builds.
3. **GPS and steps:** tap *Start GPS test*, allow location (choose "Always" if offered) and motion. Walk outside
   for about 5 minutes. Halfway, lock the phone for 2 minutes and keep walking. Unlock, tap *Stop*.
4. **Apple Health:** ideally record a short workout on your Apple Watch (or any fitness app) first. Tap
   *Check Apple Health* and allow the requested types.
5. Tap **Share report** and send it to me (paste into the chat). It contains summaries only, no coordinates.

## What we are verifying

| Question | Why it matters | Result |
|---|---|---|
| Does GPS keep recording while the phone is locked? | Outdoor workouts must not lose distance | pending |
| Points per minute and median accuracy outdoors | Location evidence rule (≥ 70 % coverage) and pace | pending |
| Pedometer steps during the walk | Motion evidence category | pending |
| `@kingstinct/react-native-healthkit` installs and works in an EAS build | Library choice for HealthKit evidence | pending (build config verified locally) |
| Apple Watch workouts show source, device and "entered by hand" flag | Rejecting manual entries, one record per session | pending |
| Heart-rate samples available for a watch workout, and how many | Heart-rate evidence and intensity | pending |
| How long until a watch workout appears in Apple Health | Confirms the 24-hour evidence window is enough | pending |

Android (Health Connect, foreground service) runs the same screen once the Android device arrives.

## Real workout check (after part 3: GPS and steps)

The live workout now records GPS and steps itself. None of this has run on a real phone yet. With a new
development build installed:

1. Start a **Walk**, allow motion and location ("While Using the App"). Walk for 5 minutes; lock the phone for
   2 of them. Distance should keep growing while locked (a blue location indicator shows on iPhone).
2. Pause, walk 50 metres, resume. The distance must not include the paused stretch.
3. Turn on airplane mode, walk another 2 minutes, tap Finish, then turn airplane mode off. The screen should go
   from "will upload when online" to "Saved", and the distance should switch to "calculated by Squad Six".
4. Compare the final distance with a known route or another app, and note the difference here.
5. Start a Walk with location denied: the screen should say it is recording time only and offer Settings.

| Check | Result |
|---|---|
| Distance keeps recording with the phone locked ("While Using" permission only) | pending |
| Paused stretch excluded | pending |
| Offline finish uploads later and the server number appears | pending |
| Distance versus a known route | pending |
| Steps appear (iPhone: within about a minute) | pending |

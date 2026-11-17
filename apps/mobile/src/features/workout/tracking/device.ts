import * as Location from "expo-location";
import { Pedometer } from "expo-sensors";
import Storage from "expo-sqlite/kv-store";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import type { TrackingStore } from "./local-store";
import { createSqliteStore } from "./local-store.sqlite";
import { minuteOf, stepDelta, stepPieces } from "./steps";
import { normalizeFix, type Interval, type TrackPoint } from "./track";

// The phone side of tracking: the background location task and the step counter. Readings go
// straight into the on-device buffer; uploading and the live totals are handled by the workout store.
// TaskManager tasks must be defined when the app starts, so the root layout imports this file.
//
// Location is collected only between startLocation() and stopLocation(), i.e. only while a GPS
// workout's timer is running, and only with "While Using the App" permission: the workout is started
// by the athlete in the foreground, which is what lets it continue with the screen locked.

export const WORKOUT_LOCATION_TASK = "squadsix-workout-location";

export type SensorStatus = "off" | "on" | "denied" | "unavailable";

type Target = { session: string; startedAt: number };
const TARGET_KEY = "squadsix.tracking.target";
const CURSOR_KEY = "squadsix.tracking.steps_cursor";

let store: TrackingStore | null = null;
export const trackingStore = (): TrackingStore => (store ??= createSqliteStore());

function readJson<T>(key: string): T | null {
  try {
    const raw = Storage.getItemSync(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// Location ----------------------------------------------------------------------------------------

type PointListener = (session: string, points: TrackPoint[]) => void;
const pointListeners = new Set<PointListener>();
export function onTrackPoints(fn: PointListener): () => void {
  pointListeners.add(fn);
  return () => {
    pointListeners.delete(fn);
  };
}

/** At most about one fix per second is kept. */
const MIN_SPACING_MS = 900;
let lastKeptAt = 0;

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(WORKOUT_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const target = readJson<Target>(TARGET_KEY);
  if (!target) {
    // No workout is being tracked (e.g. the app was reinstalled mid-workout): stop collecting location.
    await Location.stopLocationUpdatesAsync(WORKOUT_LOCATION_TASK).catch(() => {});
    return;
  }
  const points: TrackPoint[] = [];
  for (const location of data.locations) {
    const p = normalizeFix(location);
    // Phones can replay an older cached fix when tracking starts.
    if (!p || p.t < target.startedAt || p.t - lastKeptAt < MIN_SPACING_MS) continue;
    lastKeptAt = p.t;
    points.push(p);
  }
  if (points.length === 0) return;
  trackingStore().addPoints(target.session, points);
  pointListeners.forEach((fn) => fn(target.session, points));
});

export async function startLocation(session: string, startedAt: number): Promise<SensorStatus> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) return "unavailable";
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return "denied";

    Storage.setItemSync(TARGET_KEY, JSON.stringify({ session, startedAt } satisfies Target));
    if (!(await Location.hasStartedLocationUpdatesAsync(WORKOUT_LOCATION_TASK))) {
      await Location.startLocationUpdatesAsync(WORKOUT_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        activityType: Location.ActivityType.Fitness,
        timeInterval: 1000,
        distanceInterval: 0,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        // Android keeps tracking with the screen off only while this notification is showing.
        foregroundService: {
          notificationTitle: "Workout in progress",
          notificationBody: "Squad Six is measuring your distance. Open the app to pause or finish.",
        },
      });
    }
    return "on";
  } catch {
    return "unavailable";
  }
}

export async function stopLocation(): Promise<void> {
  Storage.removeItemSync(TARGET_KEY);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(WORKOUT_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(WORKOUT_LOCATION_TASK);
    }
  } catch {
    // Already stopped.
  }
}

// Steps -------------------------------------------------------------------------------------------
// iPhone: the phone keeps its own step history, so finished minutes are read from it (collectSteps);
// that also covers time with the screen locked. Android: steps are only reported while the app is
// running, as a growing total, so each report's increase is added to the current minute.

let stepSubscription: { remove(): void } | null = null;

export async function startSteps(session: string, onSteps: () => void): Promise<SensorStatus> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return "unavailable";
    let permission = await Pedometer.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await Pedometer.requestPermissionsAsync();
    if (!permission.granted) return "denied";

    if (Platform.OS === "android") {
      stepSubscription?.remove();
      let lastTotal: number | null = null;
      stepSubscription = Pedometer.watchStepCount(({ steps }) => {
        const added = stepDelta(lastTotal, steps);
        lastTotal = steps;
        if (added > 0) {
          trackingStore().addSteps(session, minuteOf(Date.now()), added);
          onSteps();
        }
      });
    }
    return "on";
  } catch {
    return "unavailable";
  }
}

export function stopSteps(): void {
  stepSubscription?.remove();
  stepSubscription = null;
}

let collecting = false;

/** iPhone only: read the steps for active minutes that have finished since the last call. */
export async function collectSteps(session: string, intervals: readonly Interval[], now: number): Promise<boolean> {
  if (Platform.OS !== "ios" || collecting) return false;
  collecting = true;
  let added = false;
  try {
    const saved = readJson<{ session: string; cursor: number }>(CURSOR_KEY);
    let cursor = saved?.session === session ? saved.cursor : 0;
    for (const piece of stepPieces(intervals, cursor, now)) {
      const { steps } = await Pedometer.getStepCountAsync(new Date(piece.from), new Date(piece.to));
      if (steps > 0) {
        trackingStore().addSteps(session, piece.minute, steps);
        added = true;
      }
      cursor = piece.to;
      Storage.setItemSync(CURSOR_KEY, JSON.stringify({ session, cursor }));
    }
  } catch {
    // Not allowed or not available right now: the cursor stays, so the next call tries again.
  } finally {
    collecting = false;
  }
  return added;
}

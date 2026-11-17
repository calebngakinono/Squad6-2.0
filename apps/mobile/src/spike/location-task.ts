import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { AppState } from "react-native";
import type { GpsPoint } from "./gps-summary";

// Background location for the device check only. Points stay in memory on the phone and are never
// uploaded. TaskManager tasks must be defined at module load, so this file is imported by the root layout.
export const DEVICE_CHECK_LOCATION_TASK = "squadsix-device-check-location";

const points: GpsPoint[] = [];
const listeners = new Set<() => void>();

export function recordLocations(locations: readonly Location.LocationObject[]) {
  const inBackground = AppState.currentState !== "active";
  for (const l of locations) {
    points.push({
      timestamp: l.timestamp,
      latitude: l.coords.latitude,
      longitude: l.coords.longitude,
      accuracy: l.coords.accuracy ?? null,
      speed: l.coords.speed ?? null,
      mocked: l.mocked ?? false,
      inBackground,
    });
  }
  listeners.forEach((fn) => fn());
}

export const getRecordedPoints = (): readonly GpsPoint[] => points;
export function clearRecordedPoints() {
  points.length = 0;
  listeners.forEach((fn) => fn());
}
export function subscribeToPoints(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(DEVICE_CHECK_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  recordLocations(data.locations);
});

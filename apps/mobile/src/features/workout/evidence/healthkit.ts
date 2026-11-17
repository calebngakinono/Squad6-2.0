import {
  isHealthDataAvailable,
  queryQuantitySamples,
  queryWorkoutSamples,
  requestAuthorization,
  WorkoutActivityType,
  WorkoutTypeIdentifier,
} from "@kingstinct/react-native-healthkit";
import { Platform } from "react-native";
import type { EvidenceProvider } from "./attach";
import { toKcal, toMetres, type PlatformWorkout } from "./match";

// Apple Health as an evidence provider. Read-only, and only the two types this feature needs:
// workouts and heart rate. Nothing is written to Apple Health.
//
// iOS never tells an app whether read access was denied: a denied read looks exactly like "no data".
// So nothing here reports "denied"; the UI says "no matching workout found".

const READ_TYPES = [WorkoutTypeIdentifier, "HKQuantityTypeIdentifierHeartRate"] as const;

export function appleHealthAvailable(): boolean {
  try {
    return Platform.OS === "ios" && isHealthDataAvailable();
  } catch {
    return false;
  }
}

/** Shows Apple's permission sheet the first time; afterwards returns immediately. */
export async function requestAppleHealth(): Promise<boolean> {
  try {
    await requestAuthorization({ toRead: READ_TYPES });
    return true;
  } catch {
    return false;
  }
}

/** A workout can start well before the Squad Six one and still overlap it. */
const LOOK_BACK_MS = 12 * 60 * 60 * 1000;

export const appleHealth: EvidenceProvider = {
  async findWorkouts(span) {
    const workouts = await queryWorkoutSamples({
      limit: 50,
      ascending: false,
      filter: { date: { startDate: new Date(span.start - LOOK_BACK_MS), endDate: new Date(span.end) } },
    });
    return workouts.map(
      (w): PlatformWorkout => ({
        provider: "healthkit",
        id: w.uuid,
        sourceName: w.sourceRevision.source.name ?? null,
        bundleId: w.sourceRevision.source.bundleIdentifier,
        deviceName: w.device?.name ?? null,
        activity: WorkoutActivityType[w.workoutActivityType] ?? null,
        start: w.startDate.getTime(),
        end: w.endDate.getTime(),
        userEntered: w.metadata?.HKWasUserEntered === true,
        distanceM: w.totalDistance ? toMetres(w.totalDistance.quantity, w.totalDistance.unit) : null,
        energyKcal: w.totalEnergyBurned ? toKcal(w.totalEnergyBurned.quantity, w.totalEnergyBurned.unit) : null,
      }),
    );
  },
  async heartRate(span) {
    const samples = await queryQuantitySamples("HKQuantityTypeIdentifierHeartRate", {
      limit: 0,
      unit: "count/min",
      filter: { date: { startDate: new Date(span.start), endDate: new Date(span.end) } },
    });
    return samples.map((s) => ({ t: s.startDate.getTime(), bpm: s.quantity }));
  },
};

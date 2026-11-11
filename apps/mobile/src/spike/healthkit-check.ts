import {
  isHealthDataAvailable,
  queryQuantitySamples,
  queryWorkoutSamples,
  requestAuthorization,
  WorkoutActivityType,
  WorkoutTypeIdentifier,
} from "@kingstinct/react-native-healthkit";

// Read-only HealthKit probe for the device check. Answers the "(verify)" items in
// docs/health-integrations.md. Nothing is uploaded; results are shown on screen and shared by the user.

export type WorkoutFinding = {
  uuid: string;
  activity: string;
  start: string;
  end: string;
  durationMin: number;
  distance: string | null;
  source: string;
  bundleId: string;
  device: string | null;
  userEntered: boolean;
};

export type HeartRateFinding = { samples: number; min: number; avg: number; max: number } | null;

export type HealthKitResult =
  | { status: "unavailable" }
  | { status: "error"; message: string }
  | { status: "ok"; workouts: WorkoutFinding[]; latestWorkoutHeartRate: HeartRateFinding };

const READ_TYPES = [
  WorkoutTypeIdentifier,
  "HKQuantityTypeIdentifierHeartRate",
  "HKQuantityTypeIdentifierDistanceWalkingRunning",
  "HKQuantityTypeIdentifierStepCount",
] as const;

export async function runHealthKitCheck(): Promise<HealthKitResult> {
  if (!isHealthDataAvailable()) return { status: "unavailable" };
  try {
    // iOS shows the permission sheet only the first time. Afterwards this returns immediately.
    await requestAuthorization({ toRead: READ_TYPES });

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const workouts = await queryWorkoutSamples({
      limit: 10,
      ascending: false,
      filter: { date: { startDate: since } },
    });

    const findings: WorkoutFinding[] = workouts.map((w) => ({
      uuid: w.uuid,
      activity: WorkoutActivityType[w.workoutActivityType] ?? String(w.workoutActivityType),
      start: w.startDate.toISOString(),
      end: w.endDate.toISOString(),
      durationMin: Math.round((w.endDate.getTime() - w.startDate.getTime()) / 6000) / 10,
      distance: w.totalDistance ? `${w.totalDistance.quantity.toFixed(2)} ${w.totalDistance.unit}` : null,
      source: w.sourceRevision.source.name,
      bundleId: w.sourceRevision.source.bundleIdentifier,
      device: w.device?.name ?? null,
      userEntered: w.metadata?.HKWasUserEntered === true,
    }));

    let latestWorkoutHeartRate: HeartRateFinding = null;
    const latest = workouts[0];
    if (latest) {
      const hr = await queryQuantitySamples("HKQuantityTypeIdentifierHeartRate", {
        limit: 0,
        unit: "count/min",
        filter: { date: { startDate: latest.startDate, endDate: latest.endDate } },
      });
      const values = hr.map((s) => s.quantity);
      if (values.length > 0) {
        latestWorkoutHeartRate = {
          samples: values.length,
          min: Math.round(Math.min(...values)),
          avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
          max: Math.round(Math.max(...values)),
        };
      }
    }

    return { status: "ok", workouts: findings, latestWorkoutHeartRate };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

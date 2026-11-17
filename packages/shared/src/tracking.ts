import { z } from "zod";

// What the phone uploads during a workout: GPS fixes and steps per clock minute. The phone never
// uploads a distance: the server computes it (supabase/migrations/*_workout_tracking.sql).
// These schemas mirror the database checks so a bad reading is dropped on the phone, not refused later.

/** Activities that record location. The server refuses location for anything else. */
export const GPS_ACTIVITIES = ["run", "walk", "hike", "cycle"] as const;

/** Rules shared by the server's metric calculation and the phone's live display. Keep in sync with the migration. */
export const TRACKING_RULES = {
  /** Fixes less accurate than this are ignored for distance. */
  maxAccuracyM: 30,
  /** A fix counts once it is this far from the last counted fix (ignores jitter while standing still). */
  minMoveM: 5,
  /** Fixes further apart than this leave a gap in coverage. */
  maxGapSeconds: 30,
  /** Faster jumps are left out of the distance (m/s). A noise filter, not the scoring check. */
  maxSpeedMs: { cycle: 25, default: 12.5 },
  maxPointsPerUpload: 500,
  maxSamplesPerUpload: 750,
  maxStepsPerMinute: 400,
} as const;

export const routePointSchema = z.object({
  t: z.iso.datetime(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  acc: z.number().min(0).nullable(),
  alt: z.number().min(-500).max(9000).nullable(),
  spd: z.number().min(0).nullable(),
  mock: z.boolean(),
});
export type RoutePoint = z.infer<typeof routePointSchema>;

export const motionSampleSchema = z.object({
  /** Start of the clock minute. */
  t: z.iso.datetime().refine((v) => Date.parse(v) % 60_000 === 0, "must start on a clock minute"),
  /** Seconds of that minute the workout timer was running. */
  s: z.number().int().min(1).max(60),
  steps: z.number().int().min(0).max(TRACKING_RULES.maxStepsPerMinute),
});
export type MotionSample = z.infer<typeof motionSampleSchema>;

export const WORKOUT_METRICS = [
  "distance_m",
  "gps_coverage",
  "gps_points",
  "gps_mocked_points",
  "gps_excluded_m",
  "steps",
  "motion_coverage",
  "avg_heart_rate",
  "max_heart_rate",
  "hr_coverage",
  "active_energy_kcal",
  "platform_overlap",
] as const;

/** A server-computed measurement, as read back from workout_metrics. */
export const workoutMetricSchema = z.object({
  metric: z.enum(WORKOUT_METRICS),
  value: z.number(),
  source: z.enum(["gps", "pedometer", "healthkit", "health_connect", "ble_hr", "manual"]),
  provenance: z.enum(["live", "synced", "manual", "estimated"]),
});
export type WorkoutMetric = z.infer<typeof workoutMetricSchema>;

import { z } from "zod";

// A teammate's workout as squad_activity() returns it: a summary only (no route, distance or health data).
export const squadActivityRowSchema = z.object({
  session_id: z.string(),
  user_id: z.string(),
  display_name: z.string().nullable(),
  activity: z.string(),
  local_date: z.string(),
  ended_at: z.string(),
  active_minutes: z.number().int(),
  status: z.string(),
  points: z.number().int(),
  is_me: z.boolean(),
});
export type SquadActivityRow = z.infer<typeof squadActivityRowSchema>;

/** One of my own finished workouts, for the history list. */
export const myWorkoutSchema = z.object({
  id: z.string(),
  activity: z.string(),
  state: z.string(),
  started_at: z.string(),
  ended_at: z.string().nullable(),
  active_seconds: z.number().int().nullable(),
  local_date: z.string(),
  workout_scores: z.object({ status: z.string(), total: z.number().int() }).nullable(),
});
export type MyWorkout = z.infer<typeof myWorkoutSchema>;

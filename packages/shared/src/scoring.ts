import { z } from "zod";

// The scoring outcome for a finished workout, as read back from workout_scores. Computed entirely by
// the server (supabase/migrations/*_scoring_engine.sql); the app only displays it.

export const SCORE_STATUSES = ["accepted", "recorded", "needs_review", "merged", "rejected"] as const;
export const EVIDENCE_CATEGORIES = ["location", "motion", "heart_rate", "platform_record", "live_set_log"] as const;
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export const workoutScoreSchema = z.object({
  status: z.enum(SCORE_STATUSES),
  categories: z.array(z.string()),
  base: z.number().int(),
  verification: z.number().int(),
  performance: z.number().int(),
  factor: z.number(),
  total: z.number().int(),
  detail: z
    .object({
      reason: z.string().optional(),
      notes: z.array(z.string()).optional(),
      merged_workouts: z.number().optional(),
    })
    .loose(),
});
export type WorkoutScore = z.infer<typeof workoutScoreSchema>;

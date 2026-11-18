import { z } from "zod";

// Official weekly challenges (supabase/migrations/*_challenges.sql, docs/scoring-proposal.md §5).
// Progress, tiers and points are computed by the server; the app only reads and displays them.

export const CHALLENGE_WEEKS = ["current", "next"] as const;
export type ChallengeWeek = (typeof CHALLENGE_WEEKS)[number];

/** Payload for join_challenge(). Validated before it is sent. */
export const joinChallengeInputSchema = z.object({
  challenge: z.string().regex(/^[a-z0-9-]{3,60}$/),
  week: z.enum(CHALLENGE_WEEKS),
});
export type JoinChallengeInput = z.infer<typeof joinChallengeInputSchema>;

export const challengeTierSchema = z.object({
  tier: z.string(),
  points: z.number().int(),
  measure: z.enum(["accepted_workouts", "validated_distance_m"]),
  target: z.number(),
});
export type ChallengeTier = z.infer<typeof challengeTierSchema>;

export const individualChallengeConfigSchema = z.object({
  distance_activities: z.array(z.string()),
  tiers: z.array(challengeTierSchema).min(1),
});

export const squadChallengeConfigSchema = z.object({
  tier: z.string(),
  points: z.number().int(),
  workouts_each: z.number().int().positive(),
  share_num: z.number().int().positive(),
  share_den: z.number().int().positive(),
  min_roster: z.number().int().positive(),
});

const baseRow = {
  challenge_id: z.string(),
  title: z.string(),
  description: z.string(),
  week_start: z.string(),
  week_ends_at: z.string(),
  join_closes_at: z.string(),
  joined: z.boolean(),
  /** Why the athlete can't join this week (null when they can, or already did). */
  join_blocked: z.enum(["join_window_closed", "too_many_challenges", "not_in_squad", "joined_squad_mid_week"]).nullable(),
  joined_next_week: z.boolean(),
  accepted_workouts: z.number().int(),
  validated_distance_m: z.number(),
  /** Highest tier reached this week, as the server last computed it. */
  tier: z.string().nullable(),
  /** Points actually paid for this challenge this week (from the ledger, after the weekly cap). */
  points: z.number().int(),
  squad_roster: z.number().int().nullable(),
  squad_required: z.number().int().nullable(),
  squad_qualified: z.number().int().nullable(),
  /** False when scoring is switched off in this environment: challenges then award nothing. */
  scoring_on: z.boolean(),
};

/** One row of my_challenges(). */
export const myChallengeSchema = z.discriminatedUnion("kind", [
  z.object({ ...baseRow, kind: z.literal("individual_tiered"), config: individualChallengeConfigSchema }),
  z.object({ ...baseRow, kind: z.literal("squad_participation"), config: squadChallengeConfigSchema }),
]);
export type MyChallenge = z.infer<typeof myChallengeSchema>;

/** Challenge points are capped at this many per athlete per week (enforced by the server). */
export const WEEKLY_CHALLENGE_CAP = 250;

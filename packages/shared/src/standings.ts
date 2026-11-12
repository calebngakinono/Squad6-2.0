import { z } from "zod";

// Season standings rows as returned by athlete_standings() and squad_standings()
// (supabase/migrations/*_standings.sql). Totals are derived from the points ledger on the server.

export const athleteStandingSchema = z.object({
  rank: z.number().int(),
  user_id: z.string(),
  display_name: z.string().nullable(),
  city: z.string().nullable(),
  points: z.number().int(),
  is_me: z.boolean(),
});
export type AthleteStanding = z.infer<typeof athleteStandingSchema>;

export const squadStandingSchema = z.object({
  /** Null when the squad is too small to be ranked. */
  rank: z.number().int().nullable(),
  squad_id: z.string(),
  name: z.string(),
  city: z.string(),
  /** Average points per member-season. */
  score: z.number().int(),
  points: z.number().int(),
  members: z.number().int(),
  is_ranked: z.boolean(),
  is_mine: z.boolean(),
});
export type SquadStanding = z.infer<typeof squadStandingSchema>;

/** A squad needs this many current members to be ranked. */
export const MIN_RANKED_SQUAD_MEMBERS = 3;

/** The first season Squad Six has standings for. */
export const FIRST_SEASON = 2026;

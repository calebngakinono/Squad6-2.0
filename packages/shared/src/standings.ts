import { z } from "zod";

// Season standings as returned by squad_standings() and athlete_standings() (supabase/migrations).
// Squads rank by their home city; athletes by their own city (Caleb, 2026-11-22). City, country or world.
// Totals are derived from the points ledger on the server.

export const STANDINGS_SCOPES = ["city", "country", "world"] as const;
export type StandingsScope = (typeof STANDINGS_SCOPES)[number];

export const squadStandingSchema = z.object({
  /** Null until the squad has enough members to be ranked. */
  rank: z.number().int().nullable(),
  squad_id: z.string(),
  name: z.string(),
  city: z.string(),
  country: z.string().nullable(),
  /** Everything the squad's members earned while in it this season. */
  points: z.number().int(),
  members: z.number().int(),
  is_ranked: z.boolean(),
  is_mine: z.boolean(),
});
export type SquadStanding = z.infer<typeof squadStandingSchema>;

/** One athlete on the individual board: a name, a city and points only (never a user id). */
export const athleteStandingSchema = z.object({
  /** Null for the caller's own row while they have no points yet. */
  rank: z.number().int().nullable(),
  display_name: z.string().nullable(),
  city: z.string().nullable(),
  points: z.number().int(),
  is_me: z.boolean(),
});
export type AthleteStanding = z.infer<typeof athleteStandingSchema>;

/** The city and country the caller's standings are centred on. */
export const standingsPlaceSchema = z.object({
  city_id: z.number().int(),
  city: z.string(),
  country_code: z.string(),
  country: z.string(),
});
export type StandingsPlace = z.infer<typeof standingsPlaceSchema>;

/** A squad is ranked once it has this many current members. It earns points normally before that. */
export const MIN_RANKED_SQUAD_MEMBERS = 4;

/** The first season Squad Six has standings for. */
export const FIRST_SEASON = 2026;

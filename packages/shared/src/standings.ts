import { z } from "zod";

// Season standings as returned by squad_standings() (supabase/migrations/*_standings.sql).
// Only squads are ranked (city, country, world); an athlete sees their own season total and no ranking.
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

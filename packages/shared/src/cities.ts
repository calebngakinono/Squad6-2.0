import { z } from "zod";

// A city from the server's fixed list (public.cities: every city over 15,000 people, from GeoNames).
// Athletes and squads store a city id; nothing accepts a typed city name.

export const citySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  region: z.string().nullable(),
  country_code: z.string(),
  country: z.string(),
});
export type City = z.infer<typeof citySchema>;

/** "Denver, Colorado": the same label the server stores next to profiles and squads. */
export const cityLabel = (c: Pick<City, "name" | "region" | "country">) => `${c.name}, ${c.region ?? c.country}`;

/** For a result list, where two cities can share a name: "Colorado · United States". */
export const cityDetail = (c: Pick<City, "region" | "country">) => (c.region ? `${c.region} · ${c.country}` : c.country);

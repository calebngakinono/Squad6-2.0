import { squadStandingSchema, standingsPlaceSchema, type SquadStanding, type StandingsPlace, type StandingsScope } from "@squad-six/shared";
import { supabase } from "@/lib/supabase";

// Standings are computed by the server from the points ledger; the app only reads them.
// Only squads are ranked. An athlete sees their own season total, never a ranking of individuals.

export async function loadSquadStandings(season: number, scope: StandingsScope, maxRows = 50): Promise<SquadStanding[]> {
  const { data, error } = await supabase.rpc("squad_standings", { season, scope, max_rows: maxRows });
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const parsed = squadStandingSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

/** The signed-in athlete's own points this season. */
export async function loadMySeasonPoints(season: number): Promise<number> {
  const { data, error } = await supabase.rpc("my_season_points", { season });
  if (error) throw error;
  return data ?? 0;
}

/** The city and country the athlete's standings are centred on; null until they have chosen a city. */
export async function loadMyStandingsPlace(): Promise<StandingsPlace | null> {
  const { data, error } = await supabase.rpc("my_standings_place");
  if (error) throw error;
  const parsed = standingsPlaceSchema.safeParse(data?.[0]);
  return parsed.success ? parsed.data : null;
}

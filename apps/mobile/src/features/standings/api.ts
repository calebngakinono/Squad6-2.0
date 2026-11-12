import { athleteStandingSchema, squadStandingSchema, type AthleteStanding, type SquadStanding } from "@squad-six/shared";
import { supabase } from "@/lib/supabase";

// Standings are computed by the server from the points ledger; the app only reads them.

export async function loadAthleteStandings(season: number, city: string | null, maxRows = 50): Promise<AthleteStanding[]> {
  const { data, error } = await supabase.rpc("athlete_standings", { season, in_city: city ?? undefined, max_rows: maxRows });
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const parsed = athleteStandingSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function loadSquadStandings(season: number, city: string | null, maxRows = 50): Promise<SquadStanding[]> {
  const { data, error } = await supabase.rpc("squad_standings", { season, in_city: city ?? undefined, max_rows: maxRows });
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const parsed = squadStandingSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

/** The signed-in athlete's own season line (null when they have no points yet). */
export async function loadMySeason(season: number): Promise<AthleteStanding | null> {
  return (await loadAthleteStandings(season, null, 1)).find((r) => r.is_me) ?? null;
}

export async function loadMyCity(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("profiles").select("city").eq("id", userId).single();
  if (error) throw error;
  return data.city?.trim() || null;
}

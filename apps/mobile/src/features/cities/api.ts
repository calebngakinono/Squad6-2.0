import { citySchema, type City } from "@squad-six/shared";
import { supabase } from "@/lib/supabase";

// Cities come from a fixed list on the server. The app never accepts a typed city: it searches the
// list and stores the chosen city's id.

export async function searchCities(query: string): Promise<City[]> {
  if (query.trim().length < 2) return [];
  const { data, error } = await supabase.rpc("search_cities", { query: query.trim(), max_rows: 8 });
  if (error) throw error;
  return (data ?? []).map((row) => citySchema.parse(row));
}

export async function loadCity(id: number): Promise<City | null> {
  const { data, error } = await supabase.from("cities").select("id, name, region, country_code, country").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? citySchema.parse(data) : null;
}

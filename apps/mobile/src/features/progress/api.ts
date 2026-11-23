import { progressSchema, type Progress } from "@squad-six/shared";
import { supabase } from "@/lib/supabase";

/** My own season: points, workouts, goal streak and the last 12 weeks (squad or no squad). */
export async function loadMyProgress(season: number): Promise<Progress | null> {
  const { data, error } = await supabase.rpc("my_progress", { season });
  if (error) throw error;
  const parsed = progressSchema.safeParse(data?.[0]);
  return parsed.success ? parsed.data : null;
}

import { weekGoalRowSchema, type WeekGoalRow } from "@squad-six/shared";
import { supabase } from "@/lib/supabase";

/** My weekly goal and progress, plus my squad's (counts only; squad members only). */
export async function loadWeekGoals(): Promise<WeekGoalRow[]> {
  const { data, error } = await supabase.rpc("squad_week_goals");
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const parsed = weekGoalRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

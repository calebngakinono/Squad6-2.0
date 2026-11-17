import { myWorkoutSchema, squadActivityRowSchema, type MyWorkout, type SquadActivityRow } from "@squad-six/shared";
import { supabase } from "@/lib/supabase";

const FINISHED = ["submitted", "accepted", "needs_review", "rejected", "expired"];

/** My finished workouts, newest first, with the server's scoring outcome when there is one. */
export async function loadMyWorkouts(limit = 100): Promise<MyWorkout[]> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("id, activity, state, started_at, ended_at, active_seconds, local_date, workout_scores!workout_scores_session_id_fkey(status, total)")
    .in("state", FINISHED)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const parsed = myWorkoutSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

/** One of my workouts (row-level security returns nothing for anyone else's). */
export async function loadMyWorkout(id: string): Promise<MyWorkout | null> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("id, activity, state, started_at, ended_at, active_seconds, local_date, workout_scores!workout_scores_session_id_fkey(status, total)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const parsed = myWorkoutSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** What my squad did recently (summaries only). Empty when I am not in a squad. */
export async function loadSquadActivity(days = 14): Promise<SquadActivityRow[]> {
  const { data, error } = await supabase.rpc("squad_activity", { days, max_rows: 100 });
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const parsed = squadActivityRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

import { joinChallengeInputSchema, myChallengeSchema, type ChallengeWeek, type MyChallenge } from "@squad-six/shared";
import { supabase } from "@/lib/supabase";

// Official weekly challenges. The server works out progress, tiers and points (from accepted workouts and
// the points ledger); the app only reads them and sends Join.

/** This week's challenges for the signed-in athlete. Empty until their home time zone is set. */
export async function loadMyChallenges(): Promise<MyChallenge[]> {
  const { data, error } = await supabase.rpc("my_challenges");
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const parsed = myChallengeSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Join a challenge for this week (only during its first 25 %) or next week. Joining twice is harmless. */
export async function joinChallenge(challenge: string, week: ChallengeWeek): Promise<void> {
  const input = joinChallengeInputSchema.parse({ challenge, week });
  const { error } = await supabase.rpc("join_challenge", input);
  if (error) throw error;
}

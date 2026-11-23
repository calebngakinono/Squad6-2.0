import { supabase } from "@/lib/supabase";

// Settings read the athlete's own rows and change them through the same guarded paths as onboarding:
// column grants for name, city and weekly goal; set_home_timezone() for the time zone (once a week).

export type AccountSettings = {
  email: string | null;
  displayName: string;
  cityId: number | null;
  city: string | null;
  homeTimezone: string | null;
  weeklyCommitment: number | null;
  /** Off the People rankings for everyone else (points still count). */
  hideFromRankings: boolean;
};

export async function loadSettings(userId: string): Promise<AccountSettings> {
  const [profile, priv, user] = await Promise.all([
    supabase.from("profiles").select("display_name, city_id, city").eq("id", userId).single(),
    supabase.from("profile_private").select("home_timezone, weekly_commitment, hide_from_rankings").eq("user_id", userId).single(),
    supabase.auth.getUser(),
  ]);
  if (profile.error) throw profile.error;
  if (priv.error) throw priv.error;
  return {
    email: user.data.user?.email ?? null,
    displayName: profile.data.display_name ?? "",
    cityId: profile.data.city_id,
    city: profile.data.city,
    homeTimezone: priv.data.home_timezone,
    weeklyCommitment: priv.data.weekly_commitment,
    hideFromRankings: priv.data.hide_from_rankings,
  };
}

async function check(promise: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await promise;
  if (error) throw error;
}

export const settingsApi = {
  setDisplayName: (userId: string, name: string) => check(supabase.from("profiles").update({ display_name: name.trim() }).eq("id", userId)),
  setCity: (userId: string, cityId: number) => check(supabase.from("profiles").update({ city_id: cityId }).eq("id", userId)),
  setWeeklyCommitment: (userId: string, days: number) =>
    check(supabase.from("profile_private").update({ weekly_commitment: days }).eq("user_id", userId)),
  setHideFromRankings: (userId: string, hide: boolean) =>
    check(supabase.from("profile_private").update({ hide_from_rankings: hide }).eq("user_id", userId)),
  setHomeTimezone: (tz: string) => check(supabase.rpc("set_home_timezone", { tz })),
  /** Deletes the account and everything personal on the server, then signs out on this phone. */
  deleteAccount: async () => {
    await check(supabase.rpc("delete_my_account"));
    await supabase.auth.signOut({ scope: "local" });
  },
};

const MESSAGES: Record<string, string> = {
  "home timezone can change once every 7 days": "Your time zone was changed in the last 7 days. You can change it again after that.",
};

export function settingsErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? "";
  if (msg.startsWith("unknown timezone")) return "This phone's time zone isn't recognised.";
  return MESSAGES[msg] ?? "Couldn't save that. Check your connection and try again.";
}

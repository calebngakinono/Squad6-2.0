import type { ChallengeTier, ChallengeWeek, MyChallenge } from "@squad-six/shared";

// Display helpers for the challenges screen. Pure, so they are unit-tested. Nothing here decides a tier
// or a point: those come from the server (my_challenges). These only turn the server's numbers into words.

const TIER_LABELS: Record<string, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", complete: "Complete" };
export const tierLabel = (tier: string) => TIER_LABELS[tier] ?? tier.charAt(0).toUpperCase() + tier.slice(1);

export const formatKm = (metres: number) => (metres / 1000).toFixed(1);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "3 accepted workouts" / "25 km of run or walk distance". */
export function tierGoal(tier: ChallengeTier, distanceActivities: string[]): string {
  if (tier.measure === "accepted_workouts") return plural(tier.target, "accepted workout");
  const what = distanceActivities.length > 0 ? `${distanceActivities.join(" or ")} distance` : "distance";
  return `${formatKm(tier.target).replace(/\.0$/, "")} km of ${what}`;
}

/** Whether a tier row should look reached: the tier the server reported, and the cheaper ones below it. */
export function tierReached(tiers: ChallengeTier[], reported: string | null, tier: ChallengeTier): boolean {
  const top = tiers.find((t) => t.tier === reported);
  return !!top && tier.points <= top.points;
}

/** The squad line: how many members are needed and how many have done it, as the server counted. */
export function squadProgress(c: Pick<MyChallenge, "squad_roster" | "squad_required" | "squad_qualified">): string | null {
  if (c.squad_roster == null || c.squad_required == null || c.squad_qualified == null) return null;
  return `${c.squad_qualified} of ${c.squad_required} needed · squad of ${c.squad_roster} when the week started`;
}

/** The Join button to offer, if any. */
export function joinAction(c: Pick<MyChallenge, "joined" | "join_blocked" | "joined_next_week">): { label: string; week: ChallengeWeek } | null {
  if (!c.joined && c.join_blocked === null) return { label: "Join this week", week: "current" };
  if (c.joined_next_week || c.join_blocked === "not_in_squad") return null;
  return { label: "Join next week", week: "next" };
}

/** A short note under a challenge the athlete hasn't joined this week. */
export function joinNote(c: Pick<MyChallenge, "joined" | "join_blocked" | "joined_next_week">): string | null {
  if (c.joined) return null;
  if (c.joined_next_week) return "You're in for next week.";
  switch (c.join_blocked) {
    case "join_window_closed":
      return "Joining closes on Tuesday at 6 pm. You can join next week's now.";
    case "too_many_challenges":
      return "You're already in 3 challenges this week.";
    case "not_in_squad":
      return "Join a squad to take part.";
    case "joined_squad_mid_week":
      return "You joined your squad after this week started, so you can take part from next week.";
    default:
      return "Only workouts you start after joining count.";
  }
}

const JOIN_ERRORS: Record<string, string> = {
  join_window_closed: "This week's challenge closed for joining on Tuesday at 6 pm.",
  too_many_challenges: "You can be in at most 3 challenges a week.",
  not_in_squad: "Join a squad first.",
  joined_squad_mid_week: "You joined your squad after this week started. Join next week's instead.",
  timezone_required: "Set your home time zone in Settings first.",
  challenge_not_running: "This challenge isn't running that week.",
  challenge_not_found: "This challenge no longer exists.",
  not_signed_in: "Please sign in again.",
};

export function joinErrorMessage(error: { message?: string } | null | undefined): string {
  const code = error?.message?.trim() ?? "";
  return JOIN_ERRORS[code] ?? "Something went wrong. Check your connection and try again.";
}

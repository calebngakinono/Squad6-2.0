import type { OutcomeKind, SquadActivityRow } from "@squad-six/shared";
import { ACTIVITIES } from "../workout/machine";

// Display helpers for history and squad activity. Pure, so they are unit-tested.

export const activityLabel = (activity: string) => ACTIVITIES.find((a) => a.value === activity)?.label ?? "Workout";

/** "Today", "Yesterday", or a short date in the athlete's own calendar ("Mon, Nov 16"). */
export function dayLabel(localDate: string, today: Date): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((start.getTime() - day.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** The outcome in a word or two, next to the points. */
export function outcomeLabel(status: string | null | undefined, points: number): string {
  switch (status) {
    case "accepted":
      return `${points.toLocaleString("en-US")} pts`;
    case "needs_review":
      return "In review";
    case "rejected":
      return "Not counted";
    case "merged":
      return "Merged";
    case "recorded":
      return "0 pts";
    case "expired":
      return "Expired";
    default:
      // No score row: not scored (yet). Never "Scoring…", which would never end on its own.
      return "Not scored";
  }
}

/** The word next to one of my workouts in My workouts, from its outcome. */
export function outcomeWord(kind: OutcomeKind, points: number): string {
  switch (kind) {
    case "counted":
      return `${points.toLocaleString("en-US")} pts`;
    case "unverified":
      return "Unverified";
    case "not_counted":
      return "0 pts";
    case "in_review":
      return "In review";
    case "merged":
      return "Merged";
    case "scoring":
      return "Scoring…";
    case "stuck":
    case "not_scored":
      return "Not scored";
    case "expired":
      return "Expired";
    case "rejected":
      return "Not counted";
    case "in_progress":
      return "In progress";
    case "discarded":
      return "Discarded";
  }
}

export type MemberWeek = { userId: string; name: string; isMe: boolean; workouts: number; points: number };

/**
 * Each current member's last 7 days: how many workouts and points. Members with no workout are
 * included with zero, so the squad can see who still needs to train this week.
 */
export function memberWeek(
  members: readonly { userId: string; name: string | null }[],
  rows: readonly SquadActivityRow[],
  myUserId: string,
  now: Date,
): MemberWeek[] {
  const since = now.getTime() - 7 * 86_400_000;
  const recent = rows.filter((r) => Date.parse(r.ended_at) > since);
  return members
    .map((m) => {
      const mine = recent.filter((r) => r.user_id === m.userId);
      return {
        userId: m.userId,
        name: m.name ?? "Athlete",
        isMe: m.userId === myUserId,
        workouts: mine.length,
        points: mine.reduce((sum, r) => sum + r.points, 0),
      };
    })
    .sort((a, b) => b.workouts - a.workouts || b.points - a.points || a.name.localeCompare(b.name));
}

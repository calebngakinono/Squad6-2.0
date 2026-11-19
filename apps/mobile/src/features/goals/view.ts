import type { WeekGoalRow } from "@squad-six/shared";

// Pure helpers for the weekly goal (kept free of React Native so they can be unit-tested). The goal
// is about showing up: no points, and no words like "missed" or "behind".

export const SQUAD_SIZE = 6;

export type Seat =
  | { kind: "member"; key: string; name: string; initials: string; isMe: boolean; goal: number | null; days: number; reached: boolean; label: string; spoken: string }
  | { kind: "open"; key: string };

export function initials(name: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? [...words[0]].slice(0, 1) : [[...words[0]][0], [...words[words.length - 1]][0]];
  return letters.join("").toUpperCase();
}

/** "2 of 4 days", or "2 days" when there is no goal. Days past the goal still count ("5 of 4 days"). */
export function goalLabel(days: number, goal: number | null): string {
  const unit = (n: number) => (n === 1 ? "day" : "days");
  return goal === null ? `${days} ${unit(days)}` : `${days} of ${goal} ${unit(goal)}`;
}

/** The line next to my own seat. */
export function myGoalLine(row: WeekGoalRow | undefined): string {
  if (!row) return "";
  if (row.weekly_goal === null) return "Set a weekly goal in Settings";
  if (row.days_this_week >= row.weekly_goal) return "Goal reached this week";
  return `${goalLabel(row.days_this_week, row.weekly_goal)} this week`;
}

/**
 * The six seats of the "this week" strip: me first, then teammates, then open seats. Without a squad
 * there is only my seat (no open seats to suggest a squad that doesn't exist).
 */
export function weekSeats(rows: WeekGoalRow[], inSquad: boolean): Seat[] {
  const members: Seat[] = rows.map((r) => {
    const name = r.is_me ? "You" : (r.display_name?.trim() || "Teammate");
    const reached = r.weekly_goal !== null && r.days_this_week >= r.weekly_goal;
    const label = goalLabel(r.days_this_week, r.weekly_goal);
    return {
      kind: "member",
      key: r.user_id,
      name,
      initials: initials(r.display_name),
      isMe: r.is_me,
      goal: r.weekly_goal,
      days: r.days_this_week,
      reached,
      label,
      spoken: `${name}, ${label} this week${reached ? ", goal reached" : ""}`,
    };
  });
  if (!inSquad) return members.filter((s) => s.kind === "member" && s.isMe);
  const open: Seat[] = Array.from({ length: Math.max(0, SQUAD_SIZE - members.length) }, (_, i) => ({ kind: "open", key: `open-${i}` }));
  return [...members, ...open];
}

/** Marks under a seat: one per goal day, filled for days trained (all filled once reached). */
export function pips(days: number, goal: number | null): boolean[] {
  const count = Math.min(7, goal ?? days);
  return Array.from({ length: count }, (_, i) => i < days);
}

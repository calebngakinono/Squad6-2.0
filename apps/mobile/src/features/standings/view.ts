import { FIRST_SEASON, MIN_RANKED_SQUAD_MEMBERS, type SquadStanding } from "@squad-six/shared";

// Display helpers for the standings screen. Pure, so they are unit-tested.

/** Seasons to offer, newest first. A season is a calendar year. */
export function seasonYears(now: Date): number[] {
  const current = Math.max(now.getFullYear(), FIRST_SEASON);
  return Array.from({ length: current - FIRST_SEASON + 1 }, (_, i) => current - i);
}

export const formatPoints = (points: number) => points.toLocaleString("en-US");

/** The line under a squad's name. */
export function squadSubtitle(squad: Pick<SquadStanding, "city" | "members" | "is_ranked">): string {
  const size = `${squad.members} member${squad.members === 1 ? "" : "s"}`;
  if (squad.is_ranked) return `${squad.city} · ${size}`;
  const missing = Math.max(1, MIN_RANKED_SQUAD_MEMBERS - squad.members);
  return `${squad.city} · ${size} · ranked with ${missing} more`;
}

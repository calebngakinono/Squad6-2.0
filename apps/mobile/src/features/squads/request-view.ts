import { formatPoints } from "@/features/standings/view";
import type { JoinRequest } from "./api";

// Words for a join request as the captain sees it. Pure, so it is unit-tested. Every number comes from
// the server (squad_join_request_details); nothing here is estimated.

const plural = (n: number, one: string, many = `${one}s`) => `${formatPoints(n)} ${n === 1 ? one : many}`;

/** "Denver, United States" / "No city set". City at most: never a precise location. */
export function requestPlace(r: Pick<JoinRequest, "city" | "country">): string {
  if (!r.city) return "No city set";
  return r.country ? `${r.city}, ${r.country}` : r.city;
}

/** "On Squad Six since Nov 2026". */
export function requestMemberSince(r: Pick<JoinRequest, "memberSince">): string {
  const d = new Date(r.memberSince);
  return `On Squad Six since ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

/** "2026 season: 12 counted workouts · 2,040 points". */
export function requestSeason(r: Pick<JoinRequest, "season" | "seasonWorkouts" | "seasonPoints">): string {
  return `${r.season} season: ${plural(r.seasonWorkouts, "counted workout")} · ${plural(r.seasonPoints, "point")}`;
}

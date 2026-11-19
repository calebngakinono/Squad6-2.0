import type { ChallengeTier, DistanceGoal } from "@squad-six/shared";
import { describe, expect, it } from "vitest";
import { formatKm, goalLabel, joinAction, joinErrorMessage, joinNote, squadProgress, tierGoal, tierLabel, tierReached } from "./view";

const tiers: ChallengeTier[] = [
  { tier: "bronze", points: 40, measure: "accepted_workouts", target: 3 },
  { tier: "silver", points: 80, measure: "accepted_workouts", target: 5 },
  { tier: "gold", points: 120, measure: "distance_goal" },
];
const goals: DistanceGoal[] = [
  { key: "run", activities: ["run"], target: 25000 },
  { key: "walk_hike", activities: ["walk", "hike"], target: 40000 },
];

describe("tiers", () => {
  it("describes each tier's goal", () => {
    expect(tierGoal(tiers[0], goals)).toBe("3 counted workouts");
    expect(tierGoal(tiers[2], goals)).toBe("Run 25 km, or walk and hike 40 km");
    expect(goals.map(goalLabel)).toEqual(["Running", "Walking and hiking"]);
    expect(tierLabel("gold")).toBe("Gold");
    expect(formatKm(12345)).toBe("12.3");
  });

  it("marks the tier the server reported, and those below it, as reached", () => {
    expect(tiers.map((t) => tierReached(tiers, "silver", t))).toEqual([true, true, false]);
    expect(tiers.map((t) => tierReached(tiers, null, t))).toEqual([false, false, false]);
  });
});

describe("squad progress", () => {
  it("shows the server's counts, or nothing without a squad", () => {
    expect(squadProgress({ squad_roster: 4, squad_required: 3, squad_qualified: 1 })).toBe(
      "1 of 3 needed · squad of 4 when the week started",
    );
    expect(squadProgress({ squad_roster: null, squad_required: null, squad_qualified: null })).toBeNull();
  });
});

describe("joining", () => {
  const base = { joined: false, join_blocked: null, joined_next_week: false } as const;

  it("offers this week while the window is open", () => {
    expect(joinAction(base)).toEqual({ label: "Join this week", week: "current" });
    expect(joinNote(base)).toBe("Only workouts you start after joining count.");
  });

  it("offers next week once this week has closed, until joined", () => {
    expect(joinAction({ ...base, join_blocked: "join_window_closed" })).toEqual({ label: "Join next week", week: "next" });
    expect(joinAction({ ...base, join_blocked: "join_window_closed", joined_next_week: true })).toBeNull();
    expect(joinNote({ ...base, join_blocked: "join_window_closed", joined_next_week: true })).toBe("You're in for next week.");
  });

  it("offers nothing without a squad for a squad challenge", () => {
    expect(joinAction({ ...base, join_blocked: "not_in_squad" })).toBeNull();
    expect(joinNote({ ...base, join_blocked: "not_in_squad" })).toBe("Join a squad to take part.");
  });

  it("maps server error codes to plain language", () => {
    expect(joinErrorMessage({ message: "join_window_closed" })).toMatch(/Tuesday/);
    expect(joinErrorMessage({ message: "boom" })).toMatch(/Something went wrong/);
  });
});

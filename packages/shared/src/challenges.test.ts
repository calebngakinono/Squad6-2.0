import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { joinChallengeInputSchema, myChallengeSchema } from "./challenges";

const row = {
  challenge_id: "weekly-tiers-v1",
  title: "Weekly tiers",
  description: "…",
  week_start: "2026-11-16",
  week_ends_at: "2026-11-23T07:00:00+00:00",
  join_closes_at: "2026-11-18T01:00:00+00:00",
  joined: true,
  join_blocked: null,
  joined_next_week: false,
  accepted_workouts: 3,
  distance_m: { run: 12000, walk_hike: 0 },
  tier: "bronze",
  points: 40,
  squad_roster: null,
  squad_required: null,
  squad_qualified: null,
  scoring_on: true,
};

describe("challenge schemas", () => {
  it("accepts the seeded challenge configs from the migration", () => {
    const dir = new URL("../../../supabase/migrations/", import.meta.url);
    const sql = readFileSync(new URL("20261118010000_challenges.sql", dir), "utf8");
    const configs = [...sql.matchAll(/'(\{\s*"(?:distance_goals|tier)"[\s\S]*?\})'/g)].map((m) => JSON.parse(m[1]));
    expect(configs).toHaveLength(2);
    expect(myChallengeSchema.safeParse({ ...row, kind: "individual_tiered", config: configs[0] }).success).toBe(true);
    expect(
      myChallengeSchema.safeParse({ ...row, kind: "squad_participation", config: configs[1], squad_roster: 4, squad_required: 3, squad_qualified: 1 })
        .success,
    ).toBe(true);
  });

  it("rejects a row whose config doesn't match its kind", () => {
    expect(myChallengeSchema.safeParse({ ...row, kind: "squad_participation", config: { tiers: [] } }).success).toBe(false);
  });

  it("validates join payloads", () => {
    expect(joinChallengeInputSchema.safeParse({ challenge: "weekly-tiers-v1", week: "next" }).success).toBe(true);
    expect(joinChallengeInputSchema.safeParse({ challenge: "weekly-tiers-v1", week: "last" }).success).toBe(false);
    expect(joinChallengeInputSchema.safeParse({ challenge: "Robert'); drop", week: "current" }).success).toBe(false);
  });
});

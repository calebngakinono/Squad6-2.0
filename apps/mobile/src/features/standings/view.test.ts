import { athleteStandingSchema, squadStandingSchema } from "@squad-six/shared";
import { describe, expect, it } from "vitest";
import { formatPoints, seasonYears, squadSubtitle } from "./view";

describe("seasonYears", () => {
  it("offers every season since the first, newest first", () => {
    expect(seasonYears(new Date(2026, 10, 12))).toEqual([2026]);
    expect(seasonYears(new Date(2028, 0, 1))).toEqual([2028, 2027, 2026]);
  });

  it("never offers a season before the first one", () => {
    expect(seasonYears(new Date(2020, 5, 1))).toEqual([2026]);
  });
});

describe("display", () => {
  it("formats points with thousands separators", () => {
    expect(formatPoints(48256)).toBe("48,256");
    expect(formatPoints(0)).toBe("0");
  });

  it("explains why a small squad is not ranked", () => {
    expect(squadSubtitle({ city: "Denver", members: 4, is_ranked: true })).toBe("Denver · 4 members");
    expect(squadSubtitle({ city: "Denver", members: 2, is_ranked: false })).toBe("Denver · 2 members · needs 1 more to be ranked");
    expect(squadSubtitle({ city: "Denver", members: 1, is_ranked: false })).toBe("Denver · 1 member · needs 2 more to be ranked");
  });
});

describe("row schemas", () => {
  it("accept what the database returns", () => {
    expect(athleteStandingSchema.safeParse({ rank: 1, user_id: "u", display_name: null, city: null, points: 214, is_me: true }).success).toBe(true);
    expect(squadStandingSchema.safeParse({ rank: null, squad_id: "s", name: "Duo", city: "Denver", score: 9000, points: 18000, members: 2, is_ranked: false, is_mine: false }).success).toBe(true);
  });
});

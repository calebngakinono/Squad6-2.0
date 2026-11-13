import { squadStandingSchema, standingsPlaceSchema } from "@squad-six/shared";
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

  it("says how many more members a squad needs to be ranked (four in total)", () => {
    expect(squadSubtitle({ city: "Denver, Colorado", members: 4, is_ranked: true })).toBe("Denver, Colorado · 4 members");
    expect(squadSubtitle({ city: "Denver, Colorado", members: 3, is_ranked: false })).toBe("Denver, Colorado · 3 members · ranked with 1 more");
    expect(squadSubtitle({ city: "Denver, Colorado", members: 1, is_ranked: false })).toBe("Denver, Colorado · 1 member · ranked with 3 more");
  });
});

describe("row schemas", () => {
  it("accept what the database returns", () => {
    expect(squadStandingSchema.safeParse({ rank: null, squad_id: "s", name: "Trio", city: "Denver, Colorado", country: "United States", points: 27000, members: 3, is_ranked: false, is_mine: false }).success).toBe(true);
    expect(standingsPlaceSchema.safeParse({ city_id: 5419384, city: "Denver", country_code: "US", country: "United States" }).success).toBe(true);
  });
});

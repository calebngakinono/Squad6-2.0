import { describe, expect, it } from "vitest";
import { requestMemberSince, requestPlace, requestSeason } from "./request-view";

describe("join request summary", () => {
  it("shows the city and country, never more", () => {
    expect(requestPlace({ city: "Denver", country: "United States" })).toBe("Denver, United States");
    expect(requestPlace({ city: "Denver", country: null })).toBe("Denver");
    expect(requestPlace({ city: null, country: null })).toBe("No city set");
  });

  it("shows how long they have been on Squad Six", () => {
    expect(requestMemberSince({ memberSince: "2026-11-15T12:00:00Z" })).toBe("On Squad Six since Nov 2026");
  });

  it("shows the server's season figures", () => {
    expect(requestSeason({ season: 2026, seasonWorkouts: 12, seasonPoints: 2040 })).toBe(
      "2026 season: 12 accepted workouts · 2,040 points",
    );
    expect(requestSeason({ season: 2026, seasonWorkouts: 1, seasonPoints: 1 })).toBe("2026 season: 1 accepted workout · 1 point");
    expect(requestSeason({ season: 2026, seasonWorkouts: 0, seasonPoints: 0 })).toBe("2026 season: 0 accepted workouts · 0 points");
  });
});

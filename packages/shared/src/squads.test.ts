import { describe, expect, it } from "vitest";
import { joinRequestDetailSchema, joinRequestInputSchema } from "./squads";

describe("join request input", () => {
  it("trims the note and drops a blank one", () => {
    expect(joinRequestInputSchema.parse({ invite_code: " ABCD2345 ", note: "  hi  " })).toEqual({ invite_code: "ABCD2345", note: "hi" });
    expect(joinRequestInputSchema.parse({ invite_code: "ABCD2345", note: "   " })).toEqual({ invite_code: "ABCD2345" });
    expect(joinRequestInputSchema.parse({ invite_code: "ABCD2345" })).toEqual({ invite_code: "ABCD2345" });
  });

  it("refuses a note over 280 characters", () => {
    expect(joinRequestInputSchema.safeParse({ invite_code: "ABCD2345", note: "x".repeat(281) }).success).toBe(false);
    expect(joinRequestInputSchema.safeParse({ invite_code: "ABCD2345", note: "x".repeat(280) }).success).toBe(true);
  });
});

describe("join request detail", () => {
  it("accepts a row from the server", () => {
    const row = {
      request_id: "r",
      user_id: "u",
      display_name: "Sam",
      note: null,
      requested_at: "2026-11-18T10:00:00Z",
      city: "Denver",
      country: "United States",
      member_since: "2026-11-01T10:00:00Z",
      season: 2026,
      season_workouts: 2,
      season_points: 340,
    };
    expect(joinRequestDetailSchema.parse(row)).toEqual(row);
  });
});

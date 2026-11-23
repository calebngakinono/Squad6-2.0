import type { WeekGoalRow } from "@squad-six/shared";
import { describe, expect, it } from "vitest";
import { finishTrailLine, goalLabel, initials, isNewDay, myGoalLine, pips, weekSeats } from "./view";

const row = (over: Partial<WeekGoalRow>): WeekGoalRow => ({
  user_id: "u1",
  display_name: "Sam Lee",
  is_me: false,
  weekly_goal: 4,
  days_this_week: 2,
  week_start: "2026-11-16",
  ...over,
});

describe("initials", () => {
  it("takes the first and last word, or one letter for one word", () => {
    expect(initials("Sam Lee")).toBe("SL");
    expect(initials("ana maría de la cruz")).toBe("AC");
    expect(initials("Jo")).toBe("J");
    expect(initials(null)).toBe("?");
  });
});

describe("goalLabel", () => {
  it("shows days out of the goal, days alone without one, and keeps counting past it", () => {
    expect(goalLabel(2, 4)).toBe("2 of 4 days");
    expect(goalLabel(0, 1)).toBe("0 of 1 day");
    expect(goalLabel(5, 4)).toBe("5 of 4 days");
    expect(goalLabel(1, null)).toBe("1 day");
  });
});

describe("myGoalLine", () => {
  it("says how far along I am, never 'behind' or 'missed'", () => {
    expect(myGoalLine(row({ is_me: true }))).toBe("2 of 4 days this week");
    expect(myGoalLine(row({ is_me: true, days_this_week: 4 }))).toBe("Goal reached this week");
    expect(myGoalLine(row({ is_me: true, weekly_goal: null }))).toBe("Set a weekly goal in Settings");
  });
});

describe("weekSeats", () => {
  const rows = [row({ user_id: "me", is_me: true, display_name: "Caleb N" }), row({ user_id: "t", days_this_week: 4 })];

  it("fills six seats: me first, teammates, then open seats", () => {
    const seats = weekSeats(rows, true);
    expect(seats).toHaveLength(6);
    expect(seats.map((s) => s.kind)).toEqual(["member", "member", "open", "open", "open", "open"]);
    expect(seats[0]).toMatchObject({ name: "You", initials: "CN", isMe: true, label: "2 of 4 days", reached: false });
    expect(seats[1]).toMatchObject({ name: "Sam Lee", reached: true, spoken: "Sam Lee, 4 of 4 days this week, goal reached" });
  });

  it("shows only my seat without a squad", () => {
    expect(weekSeats([rows[0]], false)).toHaveLength(1);
  });
});

describe("pips", () => {
  it("draws one mark per goal day, filled for days trained", () => {
    expect(pips(2, 4)).toEqual([true, true, false, false]);
    expect(pips(5, 4)).toEqual([true, true, true, true]);
    expect(pips(3, null)).toEqual([true, true, true]);
    expect(pips(0, null)).toEqual([]);
  });
});

describe("isNewDay", () => {
  it("is true only when my day count went up since before the finish", () => {
    expect(isNewDay(2, row({ is_me: true, days_this_week: 3 }))).toBe(true);
    expect(isNewDay(3, row({ is_me: true, days_this_week: 3 }))).toBe(false);
    expect(isNewDay(null, row({ is_me: true, days_this_week: 3 }))).toBe(false);
    expect(isNewDay(2, undefined)).toBe(false);
  });
});

describe("finishTrailLine", () => {
  it("mentions the squad only when there are teammates, and says nothing when unknown", () => {
    expect(finishTrailLine(true, 3)).toMatch(/Your squad sees it/);
    expect(finishTrailLine(true, 0)).toBe("Today's blaze is on your trail.");
    expect(finishTrailLine(false, 3)).toBe("Today was already on your trail.");
    expect(finishTrailLine(null, 3)).toBeNull();
  });
});

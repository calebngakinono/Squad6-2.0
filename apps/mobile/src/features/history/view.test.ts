import type { SquadActivityRow } from "@squad-six/shared";
import { describe, expect, it } from "vitest";
import { activityLabel, dayLabel, memberWeek, outcomeLabel, outcomeWord } from "./view";

const now = new Date(2026, 10, 17, 12, 0, 0);
const row = (user: string, hoursAgo: number, points: number): SquadActivityRow => ({
  session_id: `${user}-${hoursAgo}`,
  user_id: user,
  display_name: user,
  activity: "run",
  local_date: "2026-11-17",
  ended_at: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
  active_minutes: 30,
  status: "accepted",
  points,
  is_me: user === "me",
});

describe("labels", () => {
  it("names activities and outcomes", () => {
    expect(activityLabel("cycle")).toBe("Ride");
    expect(activityLabel("unknown")).toBe("Workout");
    expect(outcomeLabel("accepted", 1214)).toBe("1,214 pts");
    expect(outcomeLabel("needs_review", 0)).toBe("In review");
    expect(outcomeLabel(null, 0)).toBe("Not scored");
  });

  it("says today and yesterday, then a short date", () => {
    expect(dayLabel("2026-11-17", now)).toBe("Today");
    expect(dayLabel("2026-11-16", now)).toBe("Yesterday");
    expect(dayLabel("2026-11-10", now)).toBe("Tue, Nov 10");
  });
});

describe("memberWeek", () => {
  it("counts each member's last 7 days and keeps members who have not trained", () => {
    const members = [
      { userId: "me", name: "Me" },
      { userId: "ana", name: "Ana" },
      { userId: "ben", name: null },
    ];
    const rows = [row("ana", 2, 214), row("ana", 30, 107), row("me", 5, 200), row("me", 24 * 9, 220)];
    expect(memberWeek(members, rows, "me", now)).toEqual([
      { userId: "ana", name: "Ana", isMe: false, workouts: 2, points: 321 },
      { userId: "me", name: "Me", isMe: true, workouts: 1, points: 200 },
      { userId: "ben", name: "Athlete", isMe: false, workouts: 0, points: 0 },
    ]);
  });
});

describe("outcomeWord", () => {
  it("says what happened, never an endless Scoring…", () => {
    expect(outcomeWord("counted", 1215)).toBe("1,215 pts");
    expect(outcomeWord("unverified", 0)).toBe("Unverified");
    expect(outcomeWord("stuck", 0)).toBe("Not scored");
    expect(outcomeWord("not_scored", 0)).toBe("Not scored");
    expect(outcomeWord("scoring", 0)).toBe("Scoring…");
  });
});

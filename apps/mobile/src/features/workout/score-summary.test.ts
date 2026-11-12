import { workoutScoreSchema, type WorkoutScore } from "@squad-six/shared";
import { describe, expect, it } from "vitest";
import { summarizeScore } from "./score-summary";

const accepted: WorkoutScore = {
  status: "accepted",
  categories: ["location", "motion"],
  base: 170,
  verification: 25,
  performance: 19,
  factor: 1,
  total: 214,
  detail: { active_minutes: 30 },
};

describe("summarizeScore", () => {
  it("shows the server's breakdown for a scored workout", () => {
    expect(summarizeScore(accepted)).toEqual({
      headline: "214 points",
      lines: [
        { label: "Showing up", value: "170" },
        { label: "Verified by GPS and steps", value: "+25" },
        { label: "Performance", value: "+19" },
      ],
      notes: [],
    });
  });

  it("explains the second workout of the day and a merged workout", () => {
    const s = summarizeScore({ ...accepted, factor: 0.5, total: 107, detail: { merged_workouts: 3 } });
    expect(s.headline).toBe("107 points");
    expect(s.lines.at(-1)).toEqual({ label: "Second workout of the day", value: "× 0.5" });
    expect(s.notes).toEqual(["Scored together with 2 workouts right after it."]);
  });

  it("says why a workout earned nothing, in the server's words", () => {
    const s = summarizeScore({
      ...accepted, status: "recorded", categories: [], base: 0, verification: 0, performance: 0, factor: 0, total: 0,
      detail: { reason: "No evidence besides the timer, so this workout is saved but earns no points.", notes: ["Location did not count: GPS covered too little of the workout."] },
    });
    expect(s).toEqual({
      headline: "Saved: 0 points",
      lines: [],
      notes: ["No evidence besides the timer, so this workout is saved but earns no points.", "Location did not count: GPS covered too little of the workout."],
    });
  });

  it("labels review and merged outcomes", () => {
    const zero = { ...accepted, categories: [], base: 0, verification: 0, performance: 0, factor: 0, total: 0 };
    expect(summarizeScore({ ...zero, status: "needs_review", detail: { reason: "Average speed of 38 km/h is too fast for this activity." } }).headline).toBe("In review: no points for now");
    expect(summarizeScore({ ...zero, status: "merged", detail: {} }).headline).toBe("Counted with your previous workout");
  });

  it("accepts the row shape the database returns", () => {
    const row = { status: "accepted", categories: ["live_set_log"], base: 170, verification: 15, performance: 33, factor: 1, total: 218, detail: { effort: 22.5, live_sets: 16, notes: [] } };
    expect(workoutScoreSchema.safeParse(row).success).toBe(true);
    expect(summarizeScore(workoutScoreSchema.parse(row)).lines[1].label).toBe("Verified by your live set log");
  });
});

import { describe, expect, it } from "vitest";
import { nextMilestone, reachedMilestones, weeksReached } from "./progress";

describe("milestones", () => {
  it("lists what was reached, workouts first, and never resets with the season", () => {
    expect(reachedMilestones({ all_time_workouts: 0, best_streak: 0 })).toEqual([]);
    expect(reachedMilestones({ all_time_workouts: 12, best_streak: 4 })).toEqual(["1 workout", "5 workouts", "10 workouts", "4-week goal streak"]);
  });

  it("points at the closest milestone ahead", () => {
    expect(nextMilestone({ all_time_workouts: 0, goal_streak: 0, weekly_goal: 3 })).toEqual({ label: "1 workout", remaining: 1 });
    expect(nextMilestone({ all_time_workouts: 7, goal_streak: 3, weekly_goal: 3 })).toEqual({ label: "4-week goal streak", remaining: 1 });
    expect(nextMilestone({ all_time_workouts: 7, goal_streak: 3, weekly_goal: null })).toEqual({ label: "10 workouts", remaining: 3 });
    expect(nextMilestone({ all_time_workouts: 5000, goal_streak: 200, weekly_goal: 3 })).toBeNull();
  });

  it("counts weeks that reached the goal", () => {
    const weeks = [1, 3, 0, 4].map((days, i) => ({ week_start: `2026-11-0${i + 1}`, days }));
    expect(weeksReached({ weeks, weekly_goal: 3 })).toBe(2);
    expect(weeksReached({ weeks, weekly_goal: null })).toBe(0);
  });
});

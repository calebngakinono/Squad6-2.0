import { z } from "zod";

// Personal progress as my_progress() returns it, plus milestones derived from it. Everything here is
// a count of the person's own workouts or the server's points; nothing earns points.

export const progressSchema = z.object({
  season_points: z.number().int(),
  season_workouts: z.number().int(),
  counted_workouts: z.number().int(),
  all_time_workouts: z.number().int(),
  weekly_goal: z.number().int().nullable(),
  /** The last 12 weeks, oldest first; the last one is this week. */
  weeks: z.array(z.object({ week_start: z.string(), days: z.number().int() })),
  goal_streak: z.number().int(),
  best_streak: z.number().int(),
});
export type Progress = z.infer<typeof progressSchema>;

const WORKOUT_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
const STREAK_MILESTONES = [4, 8, 12, 26, 52, 104];

export type Milestone = { label: string; remaining: number };

const workouts = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "workout" : "workouts"}`;
const weeks = (n: number) => `${n}-week goal streak`;

/** The milestones reached so far, newest last, from all-time workouts and the best goal streak. */
export function reachedMilestones(p: Pick<Progress, "all_time_workouts" | "best_streak">): string[] {
  return [
    ...WORKOUT_MILESTONES.filter((m) => p.all_time_workouts >= m).map(workouts),
    ...STREAK_MILESTONES.filter((m) => p.best_streak >= m).map(weeks),
  ];
}

/**
 * The nearest milestone still ahead: the next workout count, or the next streak when that is closer
 * (streaks only once a weekly goal is set). Null past the last one.
 */
export function nextMilestone(p: Pick<Progress, "all_time_workouts" | "goal_streak" | "weekly_goal">): Milestone | null {
  const nextWorkouts = WORKOUT_MILESTONES.find((m) => m > p.all_time_workouts);
  const nextStreak = p.weekly_goal !== null ? STREAK_MILESTONES.find((m) => m > p.goal_streak) : undefined;
  const options: Milestone[] = [];
  if (nextWorkouts !== undefined) options.push({ label: workouts(nextWorkouts), remaining: nextWorkouts - p.all_time_workouts });
  if (nextStreak !== undefined && p.goal_streak > 0) options.push({ label: weeks(nextStreak), remaining: nextStreak - p.goal_streak });
  return options.sort((a, b) => a.remaining - b.remaining)[0] ?? null;
}

/** How many of the listed weeks reached the goal (the current, unfinished week only once it has). */
export function weeksReached(p: Pick<Progress, "weeks" | "weekly_goal">): number {
  if (p.weekly_goal === null) return 0;
  return p.weeks.filter((w) => w.days >= p.weekly_goal!).length;
}

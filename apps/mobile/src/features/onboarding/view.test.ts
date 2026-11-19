import { onboardingStepSchema, type OnboardingStep } from "@squad-six/shared";
import { describe, expect, it } from "vitest";
import { fill, gapView, parseSavedProgress, planView, routeAfterOnboarding } from "./view";

type InfoStep = Extract<OnboardingStep, { type: "info" }>;
const info = (v: unknown) => onboardingStepSchema.parse(v) as InfoStep;

const gap = info({
  id: "gap",
  type: "info",
  layout: "gap",
  title: "Here's the gap",
  body: "You want {goal} workouts a week and do {current} today.",
  params: { current: "days_now", goal: "weekly_commitment" },
  copy: { unit: "workouts a year", none_title: "You're already there.", none_body: "Stay there." },
});

const plan = info({
  id: "plan",
  type: "info",
  layout: "plan",
  title: "Your plan is ready, {name}",
  params: { goal: "weekly_commitment", squad: "squad", name: "display_name", city: "city" },
  copy: { goal: "{goal} workouts a week", squad_code: "Join with your invite code", season: "{weeks} weeks left in the {year} season" },
});

describe("fill", () => {
  it("replaces placeholders and drops unknown ones cleanly", () => {
    expect(fill("Hi {name}, {goal} a week", { name: "Sam", goal: 3 })).toBe("Hi Sam, 3 a week");
    expect(fill("Ready, {name}.", {})).toBe("Ready,.");
  });
});

describe("gapView", () => {
  it("shows the yearly gap from the two answers", () => {
    expect(gapView(gap, { days_now: 1, weekly_commitment: 4 })).toEqual({
      title: "Here's the gap",
      number: 156,
      unit: "workouts a year",
      body: "You want 4 workouts a week and do 1 today.",
    });
  });

  it("switches to the 'already there' copy with no number when there is no gap", () => {
    expect(gapView(gap, { days_now: 5, weekly_commitment: 4 })).toEqual({ title: "You're already there.", number: null, unit: null, body: "Stay there." });
  });
});

describe("planView", () => {
  const today = new Date(2026, 10, 19);

  it("lists only what the person chose, with their name in the title", () => {
    const v = planView(plan, { weekly_commitment: 4, squad: "code", display_name: " Sam " }, "Denver, Colorado", today);
    expect(v.title).toBe("Your plan is ready, Sam");
    expect(v.rows).toEqual([
      { label: "Weekly goal", value: "4 workouts a week" },
      { label: "Squad", value: "Join with your invite code" },
      { label: "Competing in", value: "Denver, Colorado" },
      { label: "Season", value: "7 weeks left in the 2026 season" },
    ]);
  });

  it("drops the comma when there is no name, and skips rows without an answer", () => {
    const v = planView(plan, {}, null, today);
    expect(v.title).toBe("Your plan is ready");
    expect(v.rows.map((r) => r.label)).toEqual(["Season"]);
  });
});

describe("parseSavedProgress", () => {
  const saved = JSON.stringify({ flowVersion: 3, stepId: "city", answers: { days_now: 2 } });

  it("restores progress for the same flow version only", () => {
    expect(parseSavedProgress(saved, 3)).toEqual({ flowVersion: 3, stepId: "city", answers: { days_now: 2 } });
    expect(parseSavedProgress(saved, 4)).toBeNull();
  });

  it("ignores missing or damaged data", () => {
    expect(parseSavedProgress(null, 3)).toBeNull();
    expect(parseSavedProgress("{not json", 3)).toBeNull();
    expect(parseSavedProgress(JSON.stringify({ flowVersion: 3, stepId: "x", answers: [] }), 3)).toBeNull();
  });
});

describe("routeAfterOnboarding", () => {
  it("opens Join or Start a squad from the squad answer, otherwise Home", () => {
    expect(routeAfterOnboarding({ squad: "code" })).toBe("/join");
    expect(routeAfterOnboarding({ squad: "start" })).toBe("/create-squad");
    expect(routeAfterOnboarding({ squad: "none" })).toBeNull();
  });
});

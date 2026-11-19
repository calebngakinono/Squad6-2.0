/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  firstIncompleteStepId,
  onboardingFlowSchema,
  pathFor,
  profileUpdates,
  seasonWeeksLeft,
  validateAnswer,
  workoutGap,
} from "./onboarding";

// Flow v3 (the active one): onboarding before sign-up, 15 screens, sign-up on 14, Pro offer on 15.
const dir = path.join(import.meta.dirname, "../../../supabase/migrations");
const file = readdirSync(dir).find((f) => f.endsWith("_onboarding_before_sign_up.sql"))!;
const sql = readFileSync(path.join(dir, file), "utf8");
const block = sql.slice(sql.indexOf("-- ONBOARDING_V3_START"), sql.indexOf("-- ONBOARDING_V3_END"));
const json = block.slice(block.indexOf("$json$") + 6, block.lastIndexOf("$json$"));

const complete = {
  reason: "routine",
  days_now: 1,
  weekly_commitment: 4,
  obstacles: ["busy"],
  tried: ["apps"],
  squad: "none",
  display_name: "Sam",
  city: 5419384,
};

describe("onboarding flow v3 (from the migration)", () => {
  const flow = onboardingFlowSchema.parse(JSON.parse(json));

  it("is version 3 with 15 screens on every path, sign-up 14th and the Pro offer last", () => {
    expect(flow.version).toBe(3);
    for (const obstacles of [["busy"], ["nobody_notices"]]) {
      const p = pathFor(flow, { ...complete, obstacles });
      expect(p).toHaveLength(15);
      expect(p[13]).toBe("signup");
      expect(p[14]).toBe("paywall");
    }
  });

  it("shows the 'you said it yourself' reframe only to people who picked that obstacle", () => {
    expect(pathFor(flow, { ...complete, obstacles: ["nobody_notices"] })).toContain("reframe_noticed");
    expect(pathFor(flow, { ...complete, obstacles: ["nobody_notices"] })).not.toContain("reframe");
    expect(pathFor(flow, complete)).toContain("reframe");
    expect(pathFor(flow, complete)).not.toContain("reframe_noticed");
  });

  it("fills name, city and weekly goal; time zone comes from the phone instead", () => {
    expect(flow.steps.flatMap((s) => (s.field ? [s.field] : [])).sort()).toEqual(["city", "display_name", "weekly_commitment"]);
    expect(profileUpdates(flow, complete)).toEqual({ display_name: "Sam", city: 5419384, weekly_commitment: 4 });
  });

  it("can be completed only with every question answered; sign-up and the Pro offer never block it", () => {
    expect(firstIncompleteStepId(flow, complete)).toBeNull();
    expect(firstIncompleteStepId(flow, { ...complete, city: undefined } as never)).toBe("city");
    const signup = flow.steps.find((s) => s.id === "signup")!;
    const paywall = flow.steps.find((s) => s.id === "paywall")!;
    expect(validateAnswer(signup, undefined)).toBeNull();
    expect(validateAnswer(paywall, undefined)).toBeNull();
  });

  it("keeps the weekly goal within 1 to 7 days", () => {
    const goal = flow.steps.find((s) => s.id === "weekly_commitment")!;
    expect(validateAnswer(goal, 0)).toBe("Choose between 1 and 7.");
    expect(validateAnswer(goal, 7)).toBeNull();
  });
});

describe("workoutGap", () => {
  const params = { current: "days_now", goal: "weekly_commitment" };

  it("counts the yearly gap from the person's own two answers", () => {
    expect(workoutGap({ days_now: 1, weekly_commitment: 4 }, params)).toEqual({ current: 1, goal: 4, yearly: 156 });
  });

  it("is zero when they already meet the goal, and absent without both answers", () => {
    expect(workoutGap({ days_now: 5, weekly_commitment: 3 }, params)?.yearly).toBe(0);
    expect(workoutGap({ days_now: 2 }, params)).toBeNull();
  });
});

describe("seasonWeeksLeft", () => {
  it("counts the current week, down to 1 on December 31", () => {
    expect(seasonWeeksLeft(new Date(2026, 0, 1))).toBe(53);
    expect(seasonWeeksLeft(new Date(2026, 10, 19))).toBe(7);
    expect(seasonWeeksLeft(new Date(2026, 11, 31))).toBe(1);
  });
});

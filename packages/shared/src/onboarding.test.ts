import { describe, expect, it } from "vitest";
import {
  answersOnPath,
  firstIncompleteStepId,
  nextStepId,
  onboardingFlowSchema,
  pathFor,
  profileUpdates,
  validateAnswer,
  type OnboardingFlow,
} from "./onboarding";

const flow: OnboardingFlow = onboardingFlowSchema.parse({
  version: 1,
  steps: [
    { id: "welcome", type: "info", title: "Welcome" },
    { id: "name", type: "text", title: "Name", field: "display_name", maxLength: 20 },
    {
      id: "experience",
      type: "single_choice",
      title: "Experience",
      options: [
        { value: "new", label: "New" },
        { value: "regular", label: "Regular" },
      ],
      branches: [{ when: { step: "experience", equals: "new" }, goto: "tips" }],
      next: "commitment",
    },
    { id: "tips", type: "info", title: "Start small" },
    { id: "commitment", type: "number", title: "Days", min: 1, max: 14, field: "weekly_commitment" },
    {
      id: "gear",
      type: "multi_choice",
      title: "Gear",
      required: false,
      options: [
        { value: "watch", label: "Watch" },
        { value: "strap", label: "Strap" },
      ],
    },
    { id: "tz", type: "timezone", title: "Time zone", field: "home_timezone" },
  ],
});

describe("onboardingFlowSchema", () => {
  it("rejects unknown branch targets and duplicate ids", () => {
    const bad = {
      version: 1,
      steps: [
        { id: "a", type: "info", title: "A", next: "missing" },
        { id: "a", type: "info", title: "Dup" },
      ],
    };
    const result = onboardingFlowSchema.safeParse(bad);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining(["duplicate step id a", "a points to unknown step missing"]),
    );
  });

  it("rejects a profile field used by two steps", () => {
    const bad = {
      version: 1,
      steps: [
        { id: "a", type: "text", title: "A", field: "city" },
        { id: "b", type: "text", title: "B", field: "city" },
      ],
    };
    expect(onboardingFlowSchema.safeParse(bad).success).toBe(false);
  });
});

describe("branching", () => {
  it("sends beginners through the tips step", () => {
    expect(nextStepId(flow, "experience", { experience: "new" })).toBe("tips");
    expect(pathFor(flow, { experience: "new" })).toEqual(["welcome", "name", "experience", "tips", "commitment", "gear", "tz"]);
  });

  it("skips tips for regulars via `next`", () => {
    expect(nextStepId(flow, "experience", { experience: "regular" })).toBe("commitment");
    expect(pathFor(flow, { experience: "regular" })).not.toContain("tips");
  });

  it("ends after the last step", () => {
    expect(nextStepId(flow, "tz", {})).toBeNull();
  });

  it("drops answers from a branch the athlete no longer takes", () => {
    const branchFlow = onboardingFlowSchema.parse({
      version: 1,
      steps: [
        {
          id: "q",
          type: "single_choice",
          title: "Q",
          options: [
            { value: "a", label: "A" },
            { value: "b", label: "B" },
          ],
          branches: [{ when: { step: "q", equals: "a" }, goto: "only_a" }],
          next: "end",
        },
        { id: "only_a", type: "text", title: "Only A" },
        { id: "end", type: "info", title: "End" },
      ],
    });
    expect(answersOnPath(branchFlow, { q: "b", only_a: "stale" })).toEqual({ q: "b" });
  });
});

describe("validateAnswer", () => {
  const step = (id: string) => flow.steps.find((s) => s.id === id)!;
  it("checks required, length, range, options and time zones", () => {
    expect(validateAnswer(step("name"), "  ")).toBe("Please answer to continue.");
    expect(validateAnswer(step("name"), "x".repeat(21))).toBe("Keep it under 20 characters.");
    expect(validateAnswer(step("commitment"), 15)).toBe("Choose between 1 and 14.");
    expect(validateAnswer(step("commitment"), 3.5)).toBe("Enter a whole number.");
    expect(validateAnswer(step("experience"), "pro")).toBe("Choose one option.");
    expect(validateAnswer(step("gear"), [])).toBeNull(); // optional
    expect(validateAnswer(step("gear"), ["watch", "watch"])).toBe("Choose each option once.");
    expect(validateAnswer(step("tz"), "America/Denver")).toBeNull();
    expect(validateAnswer(step("tz"), "not a zone")).toBe("Choose a time zone.");
    expect(validateAnswer(step("welcome"), undefined)).toBeNull();
  });
});

describe("completion", () => {
  const complete = { name: " Caleb ", experience: "regular", commitment: 4, tz: "America/Denver" };
  it("finds the first missing answer on the path", () => {
    expect(firstIncompleteStepId(flow, { name: "C" })).toBe("experience");
    expect(firstIncompleteStepId(flow, complete)).toBeNull();
  });
  it("collects trimmed profile updates from mapped steps", () => {
    expect(profileUpdates(flow, complete)).toEqual({
      display_name: "Caleb",
      weekly_commitment: 4,
      home_timezone: "America/Denver",
    });
  });
});

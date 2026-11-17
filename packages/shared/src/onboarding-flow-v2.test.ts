/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { firstIncompleteStepId, onboardingFlowSchema, profileUpdates, validateAnswer } from "./onboarding";

// Flow v2 (the active one) lives in the cities migration: same questions as v1, city chosen from a list.
const dir = path.join(import.meta.dirname, "../../../supabase/migrations");
const file = readdirSync(dir).find((f) => f.endsWith("_cities.sql"))!;
const sql = readFileSync(path.join(dir, file), "utf8");
const block = sql.slice(sql.indexOf("-- ONBOARDING_V2_START"), sql.indexOf("-- ONBOARDING_V2_END"));
const json = block.slice(block.indexOf("$json$") + 6, block.lastIndexOf("$json$"));

describe("onboarding flow v2 (from the migration)", () => {
  const flow = onboardingFlowSchema.parse(JSON.parse(json));
  const city = flow.steps.find((s) => s.id === "city")!;

  it("is valid, version 2, and asks for the same profile fields", () => {
    expect(flow.version).toBe(2);
    expect(flow.steps.flatMap((s) => (s.field ? [s.field] : [])).sort()).toEqual(["city", "display_name", "home_timezone", "weekly_commitment"]);
  });

  it("takes the city from the list, never as typed text", () => {
    expect(city.type).toBe("city");
    expect(validateAnswer(city, 5419384)).toBeNull();
    expect(validateAnswer(city, "Denver")).toBe("Choose your city from the list.");
    expect(validateAnswer(city, undefined)).toBe("Please answer to continue.");
  });

  it("cannot be completed without a city", () => {
    const answers = { display_name: "A", goal: "strength", experience: "regular", weekly_commitment: 3, home_timezone: "America/Denver" };
    expect(firstIncompleteStepId(flow, answers)).toBe("city");
    expect(firstIncompleteStepId(flow, { ...answers, city: 5419384 })).toBeNull();
    expect(profileUpdates(flow, { ...answers, city: 5419384 }).city).toBe(5419384);
  });
});

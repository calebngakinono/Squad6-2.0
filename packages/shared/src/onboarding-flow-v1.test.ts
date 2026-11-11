/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { onboardingFlowSchema, pathFor, profileUpdates } from "./onboarding";

// The flow lives in a migration (the database is the source of truth). Parse it here so a typo or
// broken branch fails CI instead of breaking onboarding on phones.
const dir = path.join(import.meta.dirname, "../../../supabase/migrations");
const file = readdirSync(dir).find((f) => f.endsWith("_onboarding.sql"))!;
const sql = readFileSync(path.join(dir, file), "utf8");
const block = sql.slice(sql.indexOf("-- ONBOARDING_V1_START"), sql.indexOf("-- ONBOARDING_V1_END"));
const json = block.slice(block.indexOf("$json$") + 6, block.lastIndexOf("$json$"));

describe("onboarding flow v1 (from the migration)", () => {
  const flow = onboardingFlowSchema.parse(JSON.parse(json));

  it("is valid and version 1", () => {
    expect(flow.version).toBe(1);
  });

  it("collects every profile field the server needs", () => {
    const fields = flow.steps.flatMap((s) => (s.field ? [s.field] : []));
    expect(fields.sort()).toEqual(["city", "display_name", "home_timezone", "weekly_commitment"]);
  });

  it("shows beginner tips only to beginners", () => {
    expect(pathFor(flow, { experience: "new" })).toContain("beginner_tips");
    expect(pathFor(flow, { experience: "regular" })).not.toContain("beginner_tips");
  });

  it("maps answers to profile updates", () => {
    expect(
      profileUpdates(flow, { display_name: "A", weekly_commitment: 3, city: "Denver", home_timezone: "America/Denver" }),
    ).toEqual({ display_name: "A", weekly_commitment: 3, city: "Denver", home_timezone: "America/Denver" });
  });
});

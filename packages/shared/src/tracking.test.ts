import { describe, expect, it } from "vitest";
import { motionSampleSchema, routePointSchema } from "./tracking";

const point = { t: "2026-11-12T10:00:00.000Z", lat: 37.1, lng: -113.5, acc: 5, alt: 800, spd: 3, mock: false };

describe("routePointSchema", () => {
  it("accepts a normal fix, with or without optional readings", () => {
    expect(routePointSchema.safeParse(point).success).toBe(true);
    expect(routePointSchema.safeParse({ ...point, acc: null, alt: null, spd: null }).success).toBe(true);
  });

  it.each([
    ["latitude out of range", { lat: 91 }],
    ["longitude out of range", { lng: -181 }],
    ["negative accuracy", { acc: -1 }],
    ["negative speed", { spd: -1 }],
    ["not a time", { t: "yesterday" }],
    ["not a number", { lat: Number.NaN }],
  ])("rejects %s", (_name, change) => {
    expect(routePointSchema.safeParse({ ...point, ...change }).success).toBe(false);
  });
});

describe("motionSampleSchema", () => {
  it("accepts a clock minute and rejects anything else", () => {
    expect(motionSampleSchema.safeParse({ t: "2026-11-12T10:07:00.000Z", s: 60, steps: 160 }).success).toBe(true);
    expect(motionSampleSchema.safeParse({ t: "2026-11-12T10:07:30.000Z", s: 30, steps: 80 }).success).toBe(false);
  });

  it("rejects impossible step counts and durations", () => {
    expect(motionSampleSchema.safeParse({ t: "2026-11-12T10:07:00.000Z", s: 60, steps: 401 }).success).toBe(false);
    expect(motionSampleSchema.safeParse({ t: "2026-11-12T10:07:00.000Z", s: 61, steps: 10 }).success).toBe(false);
    expect(motionSampleSchema.safeParse({ t: "2026-11-12T10:07:00.000Z", s: 0, steps: 0 }).success).toBe(false);
  });
});

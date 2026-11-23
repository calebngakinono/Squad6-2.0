import { describe, expect, it } from "vitest";
import { scoringStart, workoutOutcome, type OutcomeInput } from "./outcome";

const now = new Date("2026-11-22T12:00:00Z");
const input = (over: Partial<OutcomeInput>): OutcomeInput => ({
  state: "submitted",
  startedAt: "2026-11-22T10:00:00Z",
  endedAt: "2026-11-22T11:00:00Z",
  score: null,
  scoringFrom: "2026-11-01T00:00:00Z",
  now,
  ...over,
});
const score = (status: string, over: Partial<NonNullable<OutcomeInput["score"]>> = {}) => ({
  status,
  total: 0,
  categories: [] as string[],
  verification: 0,
  detail: {},
  ...over,
});

describe("workoutOutcome", () => {
  it("never leaves a finished workout without an outcome when scoring was off", () => {
    expect(workoutOutcome(input({ scoringFrom: null })).kind).toBe("not_scored");
    // Switched on after this workout started: it is not scored either.
    expect(workoutOutcome(input({ scoringFrom: "2026-11-22T10:30:00Z" })).kind).toBe("not_scored");
  });

  it("shows scoring for a moment after Finish, then offers Try again", () => {
    expect(workoutOutcome(input({ endedAt: "2026-11-22T11:59:30Z" })).kind).toBe("scoring");
    expect(workoutOutcome(input({ endedAt: "2026-11-22T11:58:00Z" })).kind).toBe("stuck");
  });

  it("counts accepted workouts with the server's points, and keeps the evidence window open while it can still add points", () => {
    const o = workoutOutcome(input({ score: score("accepted", { total: 215, categories: ["motion"], verification: 15 }) }));
    expect(o).toMatchObject({ kind: "counted", points: 215, personal: true });
    expect(o.evidenceOpenUntil?.toISOString()).toBe("2026-11-23T11:00:00.000Z");
    const full = workoutOutcome(input({ score: score("accepted", { total: 245, verification: 30 }) }));
    expect(full.evidenceOpenUntil).toBeNull();
  });

  it("tells unverified apart from too short and from the daily limit", () => {
    const unverified = workoutOutcome(input({ score: score("recorded", { detail: { reason: "No evidence besides the timer, so this workout is saved but earns no points." } }) }));
    expect(unverified).toMatchObject({ kind: "unverified", points: 0, personal: true });
    expect(unverified.evidenceOpenUntil).not.toBeNull();
    expect(workoutOutcome(input({ score: score("recorded", { detail: { reason: "Active time was under the 10-minute minimum." } }) })).kind).toBe("not_counted");
    expect(workoutOutcome(input({ score: score("recorded", { categories: ["motion"], detail: { reason: "Third or later workout of the day" } }) })).kind).toBe("not_counted");
  });

  it("closes the evidence window 24 hours after the finish", () => {
    const old = workoutOutcome(input({ endedAt: "2026-11-21T10:00:00Z", startedAt: "2026-11-21T09:00:00Z", score: score("recorded") }));
    expect(old.kind).toBe("unverified");
    expect(old.evidenceOpenUntil).toBeNull();
  });

  it("maps review, merge and the session's own end states", () => {
    expect(workoutOutcome(input({ score: score("needs_review") })).kind).toBe("in_review");
    expect(workoutOutcome(input({ score: score("merged") })).kind).toBe("merged");
    expect(workoutOutcome(input({ state: "active", endedAt: null })).kind).toBe("in_progress");
    expect(workoutOutcome(input({ state: "cancelled" })).kind).toBe("discarded");
    expect(workoutOutcome(input({ state: "abandoned" })).kind).toBe("discarded");
    expect(workoutOutcome(input({ state: "expired" })).kind).toBe("expired");
    expect(workoutOutcome(input({ state: "rejected" })).personal).toBe(false);
  });
});

describe("scoringStart", () => {
  it("takes the earliest switch-on time, or none", () => {
    expect(scoringStart([{ active_from: null }])).toBeNull();
    expect(scoringStart([{ active_from: "2026-12-09T00:00:00Z" }, { active_from: "2026-11-01T00:00:00Z" }])).toBe("2026-11-01T00:00:00Z");
  });
});

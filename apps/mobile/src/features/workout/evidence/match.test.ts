import { platformEvidenceSchema } from "@squad-six/shared";
import { describe, expect, it } from "vitest";
import { TransportError } from "../queue";
import { matchAndAttach, type EvidenceProvider } from "./attach";
import { overlapFraction, pickEvidence, summarizeHeartRate, toEvidence, toKcal, toMetres, type PlatformWorkout } from "./match";

const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const min = (n: number) => T0 + n * 60_000;
const session = { start: min(0), end: min(30) };
const watch: PlatformWorkout = {
  provider: "healthkit",
  id: "HK-1",
  sourceName: "Caleb's Apple Watch",
  bundleId: "com.apple.health.ABC",
  deviceName: "Apple Watch",
  activity: "running",
  start: min(1),
  end: min(29),
  userEntered: false,
  distanceM: 5010.44,
  energyKcal: 410.26,
};

describe("overlapFraction", () => {
  it("is the share of the Squad Six workout the record covers", () => {
    expect(overlapFraction(session, { start: min(0), end: min(30) })).toBe(1);
    expect(overlapFraction(session, { start: min(-10), end: min(15) })).toBe(0.5);
    expect(overlapFraction(session, { start: min(40), end: min(50) })).toBe(0);
    expect(overlapFraction({ start: min(0), end: min(0) }, session)).toBe(0);
  });
});

describe("pickEvidence", () => {
  it("picks the record that overlaps most", () => {
    const short = { ...watch, id: "HK-2", start: min(20), end: min(40) };
    expect(pickEvidence(session, [short, watch])?.id).toBe("HK-1");
  });

  it("never picks a hand-typed entry or Squad Six's own record", () => {
    const typed = { ...watch, id: "typed", start: min(0), end: min(30), userEntered: true };
    const own = { ...watch, id: "own", start: min(0), end: min(30), bundleId: "com.SquadSix.app" };
    expect(pickEvidence(session, [typed, own])).toBeNull();
    expect(pickEvidence(session, [typed, own, watch])?.id).toBe("HK-1");
  });

  it("finds nothing when no record overlaps", () => {
    expect(pickEvidence(session, [{ ...watch, start: min(60), end: min(90) }])).toBeNull();
    expect(pickEvidence(session, [])).toBeNull();
  });
});

describe("units", () => {
  it("converts known units and refuses to guess unknown ones", () => {
    expect(toMetres(5, "km")).toBe(5000);
    expect(toMetres(1, "mi")).toBeCloseTo(1609.344);
    expect(toMetres(5, "furlong")).toBeNull();
    expect(toKcal(418.4, "kJ")).toBeCloseTo(100);
    expect(toKcal(100, "kcal")).toBe(100);
    expect(toKcal(100, "BTU")).toBeNull();
  });
});

describe("summarizeHeartRate", () => {
  it("summarizes samples inside the span and ignores impossible values", () => {
    const samples = [
      { t: min(-1), bpm: 80 }, // before
      { t: min(2), bpm: 120 },
      { t: min(2) + 20_000, bpm: 130 }, // same minute
      { t: min(5), bpm: 170 },
      { t: min(6), bpm: 0 }, // sensor glitch
      { t: min(6), bpm: 400 },
    ];
    expect(summarizeHeartRate(samples, session)).toEqual({ samples: 3, minutes: 2, min: 120, avg: 140, max: 170 });
  });

  it("returns nothing rather than zeros when there is no heart rate", () => {
    expect(summarizeHeartRate([], session)).toBeNull();
  });
});

describe("toEvidence", () => {
  it("builds a summary the server accepts, with missing readings left empty", () => {
    const evidence = toEvidence(watch, null);
    expect(platformEvidenceSchema.safeParse(evidence).success).toBe(true);
    expect(evidence).toMatchObject({ id: "HK-1", distance_m: 5010.4, energy_kcal: 410.3, hr_avg: null, hr_samples: null, user_entered: false });
  });
});

describe("matchAndAttach", () => {
  const provider = (workouts: PlatformWorkout[], hr = [{ t: min(3), bpm: 150 }]): EvidenceProvider => ({
    findWorkouts: async () => workouts,
    heartRate: async () => hr,
  });

  it("attaches the best match with its heart-rate summary", async () => {
    const sent: unknown[] = [];
    const outcome = await matchAndAttach(session, provider([watch]), async (e) => void sent.push(e));
    expect(outcome).toEqual({ status: "attached" });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ id: "HK-1", hr_avg: 150, hr_minutes: 1 });
  });

  it("reports nothing found without calling the server", async () => {
    let called = false;
    expect(await matchAndAttach(session, provider([]), async () => void (called = true))).toEqual({ status: "none" });
    expect(called).toBe(false);
  });

  it("still attaches when heart rate can't be read", async () => {
    const noHr: EvidenceProvider = { findWorkouts: async () => [watch], heartRate: async () => Promise.reject(new Error("locked")) };
    const sent: { hr_avg: number | null }[] = [];
    expect((await matchAndAttach(session, noHr, async (e) => void sent.push(e))).status).toBe("attached");
    expect(sent[0].hr_avg).toBeNull();
  });

  it("retries later when Apple Health or the network is unavailable", async () => {
    const locked: EvidenceProvider = { findWorkouts: async () => Promise.reject(new Error("device locked")), heartRate: async () => [] };
    expect(await matchAndAttach(session, locked, async () => {})).toEqual({ status: "retry" });
    const offline = async () => Promise.reject(new TransportError("network", "fetch failed"));
    expect(await matchAndAttach(session, provider([watch]), offline)).toEqual({ status: "retry" });
  });

  it("understands the server's refusals", async () => {
    const refuse = (code: string) => async () => Promise.reject(new TransportError("rejected", code));
    expect(await matchAndAttach(session, provider([watch]), refuse("evidence_already_attached"))).toEqual({ status: "attached" });
    expect(await matchAndAttach(session, provider([watch]), refuse("evidence_already_used"))).toEqual({ status: "none" });
    expect(await matchAndAttach(session, provider([watch]), refuse("evidence_window_closed"))).toEqual({ status: "closed", code: "evidence_window_closed" });
  });
});

import { describe, expect, it } from "vitest";
import { distanceM, summarizeGps, type GpsPoint } from "./gps-summary";

const p = (t: number, lat: number, lon: number, extra: Partial<GpsPoint> = {}): GpsPoint => ({
  timestamp: t * 1000,
  latitude: lat,
  longitude: lon,
  accuracy: 5,
  speed: null,
  mocked: false,
  inBackground: false,
  ...extra,
});

describe("distanceM", () => {
  it("measures about 111 km per degree of latitude", () => {
    expect(distanceM(p(0, 0, 0), p(1, 1, 0))).toBeCloseTo(111_195, -2);
  });
});

describe("summarizeGps", () => {
  it("returns zeros for no points", () => {
    expect(summarizeGps([])).toMatchObject({ points: 0, distanceM: 0, medianAccuracyM: null, maxSegmentSpeedMs: null });
  });

  it("sums distance, rates, gaps and background points", () => {
    // ~0.001° latitude ≈ 111 m every 30 s.
    const s = summarizeGps([
      p(0, 40, -105),
      p(30, 40.001, -105, { inBackground: true }),
      p(90, 40.002, -105, { inBackground: true }),
    ]);
    expect(s.points).toBe(3);
    expect(s.backgroundPoints).toBe(2);
    expect(s.durationSec).toBe(90);
    expect(s.pointsPerMinute).toBe(2);
    expect(s.distanceM).toBeCloseTo(222, 0);
    expect(s.longestGapSec).toBe(60);
    expect(s.maxSegmentSpeedMs).toBeCloseTo(111.2 / 30, 1);
  });

  it("ignores inaccurate points for distance but counts them", () => {
    const s = summarizeGps([p(0, 40, -105), p(10, 41, -105, { accuracy: 500 }), p(20, 40, -105)]);
    expect(s.points).toBe(3);
    expect(s.distanceM).toBe(0);
    expect(s.medianAccuracyM).toBe(5);
  });

  it("counts mocked points and sorts out-of-order input", () => {
    const s = summarizeGps([p(20, 40, -105, { mocked: true }), p(0, 40, -105)]);
    expect(s.mockedPoints).toBe(1);
    expect(s.durationSec).toBe(20);
  });
});

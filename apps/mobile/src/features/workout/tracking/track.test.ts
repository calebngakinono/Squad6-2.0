import { describe, expect, it } from "vitest";
import type { LocalEvent } from "../machine";
import { activeIntervals, formatDistance, formatPace, formatSpeed, normalizeFix, summarizeTrack, usesMiles, type TrackPoint } from "./track";

const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const sec = (n: number) => T0 + n * 1000;

/** n+1 fixes one second apart heading north, `step` degrees per second (0.00003° = 3.34 m). */
function line(startSec: number, n: number, lat0: number, step = 0.00003, extra: Partial<TrackPoint> = {}): TrackPoint[] {
  return Array.from({ length: n + 1 }, (_, i) => ({
    t: sec(startSec + i),
    lat: lat0 + i * step,
    lng: -111,
    acc: 5,
    alt: null,
    spd: null,
    mock: false,
    ...extra,
  }));
}

const events: LocalEvent[] = [
  { id: "a", kind: "start", at: sec(0) },
  { id: "b", kind: "pause", at: sec(300) },
  { id: "c", kind: "resume", at: sec(600) },
];

describe("normalizeFix", () => {
  const coords = { latitude: 37.1, longitude: -113.5, accuracy: 4.2, altitude: 812.4, speed: 2.9 };

  it("keeps a normal reading", () => {
    expect(normalizeFix({ timestamp: sec(1) + 0.4, coords, mocked: false })).toEqual({ t: sec(1), lat: 37.1, lng: -113.5, acc: 4.2, alt: 812.4, spd: 2.9, mock: false });
  });

  it("treats unknown readings (null or negative) as missing, never as numbers", () => {
    expect(normalizeFix({ timestamp: sec(1), coords: { ...coords, accuracy: -1, altitude: null, speed: -1 } })).toMatchObject({ acc: null, alt: null, spd: null, mock: false });
  });

  it("drops a reading without a usable position and keeps the mock flag", () => {
    expect(normalizeFix({ timestamp: sec(1), coords: { ...coords, latitude: Number.NaN } })).toBeNull();
    expect(normalizeFix({ timestamp: sec(1), coords, mocked: true })?.mock).toBe(true);
  });
});

describe("activeIntervals", () => {
  it("lists the stretches when the timer ran, the last one open until now", () => {
    expect(activeIntervals(events, sec(900))).toEqual([
      { from: sec(0), to: sec(300), open: false },
      { from: sec(600), to: sec(900), open: true },
    ]);
    expect(activeIntervals([...events, { id: "d", kind: "finish", at: sec(700) }], sec(900))[1]).toEqual({
      from: sec(600),
      to: sec(700),
      open: false,
    });
  });
});

describe("summarizeTrack", () => {
  const intervals = activeIntervals(events, sec(1800));

  it("measures a steady jog", () => {
    const totals = summarizeTrack(line(60, 60, 40), intervals, "run");
    expect(totals.distanceM).toBeGreaterThan(200.0);
    expect(totals.distanceM).toBeLessThan(200.3);
    expect(totals.coveredSeconds).toBe(60);
    expect(totals.goodPoints).toBe(61);
  });

  it("ignores jitter while standing still", () => {
    const still = line(60, 120, 40, 0).map((p, i) => ({ ...p, lat: p.lat + (i % 2) * 0.00002 })); // ±2 m
    expect(summarizeTrack(still, intervals, "run").distanceM).toBe(0);
  });

  it("leaves out movement during a pause and never measures across it", () => {
    const points = [...line(290, 10, 40), ...line(310, 60, 40.01), ...line(600, 10, 40.5)];
    const totals = summarizeTrack(points, intervals, "run");
    // Only the 10 s before the pause and the 10 s after the resume count; the 55 km gap between them does not.
    expect(totals.distanceM).toBeGreaterThan(60);
    expect(totals.distanceM).toBeLessThan(70);
    expect(totals.excludedM).toBe(0);
  });

  it("ignores mocked and inaccurate fixes", () => {
    const points = [...line(60, 30, 40, 0.00003, { mock: true }), ...line(120, 30, 40.1, 0.00003, { acc: 80 }), ...line(180, 30, 40.2, 0.00003, { acc: null })];
    expect(summarizeTrack(points, intervals, "run")).toMatchObject({ distanceM: 0, goodPoints: 0 });
  });

  it("leaves a GPS jump out of the distance and records it as excluded", () => {
    const points = [...line(60, 1, 40.1, 0.1), ...line(62, 2, 40.20003)];
    const totals = summarizeTrack(points, intervals, "run");
    expect(totals.excludedM).toBeGreaterThan(11_000);
    expect(totals.distanceM).toBeGreaterThan(6);
    expect(totals.distanceM).toBeLessThan(7);
  });

  it("allows cycling speeds that would be a jump on foot", () => {
    const fast = line(60, 10, 40, 0.00018); // 20 m/s
    expect(summarizeTrack(fast, intervals, "run").distanceM).toBe(0);
    expect(summarizeTrack(fast, intervals, "cycle").distanceM).toBeGreaterThan(199);
  });

  it("counts gaps longer than 30 s as uncovered", () => {
    const points = [...line(60, 10, 40), ...line(130, 10, 40.001)];
    expect(summarizeTrack(points, intervals, "run").coveredSeconds).toBe(20);
  });
});

describe("display", () => {
  it("picks miles for US and UK phones", () => {
    expect(usesMiles("en-US")).toBe(true);
    expect(usesMiles("en_GB")).toBe(true);
    expect(usesMiles("fr-FR")).toBe(false);
    expect(usesMiles("en")).toBe(false);
  });

  it("formats distance, pace and speed", () => {
    expect(formatDistance(5000, false)).toBe("5.00 km");
    expect(formatDistance(1609.344, true)).toBe("1.00 mi");
    expect(formatPace(5000, 1500, false)).toBe("5:00 /km");
    expect(formatPace(20, 60, false)).toBeNull();
    expect(formatSpeed(25_000, 3600, false)).toBe("25.0 km/h");
  });
});

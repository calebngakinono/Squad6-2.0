import { describe, expect, it } from "vitest";
import { activeSecondsInMinute, stepDelta, stepPieces, toSamples } from "./steps";
import type { Interval } from "./track";

const T0 = Date.UTC(2026, 10, 12, 10, 0, 0); // exactly on a minute
const sec = (n: number) => T0 + n * 1000;

describe("stepPieces", () => {
  it("cuts a running stretch at clock minutes and waits for the current minute to finish", () => {
    const running: Interval[] = [{ from: sec(20), to: sec(150), open: true }];
    expect(stepPieces(running, 0, sec(150))).toEqual([
      { minute: sec(0), from: sec(20), to: sec(60) },
      { minute: sec(60), from: sec(60), to: sec(120) },
    ]);
  });

  it("continues from the cursor and includes the last partial minute once the stretch has ended", () => {
    const ended: Interval[] = [{ from: sec(20), to: sec(150), open: false }];
    expect(stepPieces(ended, sec(120), sec(400))).toEqual([{ minute: sec(120), from: sec(120), to: sec(150) }]);
    expect(stepPieces(ended, sec(150), sec(400))).toEqual([]);
  });

  it("skips paused time", () => {
    const intervals: Interval[] = [
      { from: sec(0), to: sec(30), open: false },
      { from: sec(45), to: sec(70), open: false },
    ];
    expect(stepPieces(intervals, 0, sec(500))).toEqual([
      { minute: sec(0), from: sec(0), to: sec(30) },
      { minute: sec(0), from: sec(45), to: sec(60) },
      { minute: sec(60), from: sec(60), to: sec(70) },
    ]);
  });
});

describe("activeSecondsInMinute", () => {
  it("adds up the running time inside one clock minute", () => {
    const intervals: Interval[] = [
      { from: sec(0), to: sec(30), open: false },
      { from: sec(45), to: sec(70), open: false },
    ];
    expect(activeSecondsInMinute(intervals, sec(0))).toBe(45);
    expect(activeSecondsInMinute(intervals, sec(60))).toBe(10);
    expect(activeSecondsInMinute(intervals, sec(120))).toBe(0);
  });
});

describe("stepDelta", () => {
  it("turns a running total into steps since the last report", () => {
    expect(stepDelta(null, 12)).toBe(12);
    expect(stepDelta(12, 30)).toBe(18);
    expect(stepDelta(30, 4)).toBe(4); // the counter restarted
  });
});

describe("toSamples", () => {
  const rows = [
    { minute: sec(0), steps: 150 },
    { minute: sec(60), steps: 900 },
    { minute: sec(120), steps: 40 },
  ];

  it("holds back the minute still in progress and caps impossible counts", () => {
    const running: Interval[] = [{ from: sec(20), to: sec(150), open: true }];
    expect(toSamples(rows, running, sec(150))).toEqual([
      { t: new Date(sec(0)).toISOString(), s: 40, steps: 150 },
      { t: new Date(sec(60)).toISOString(), s: 60, steps: 400 },
    ]);
  });

  it("sends the last partial minute once the workout has ended", () => {
    const ended: Interval[] = [{ from: sec(20), to: sec(150), open: false }];
    expect(toSamples(rows, ended, sec(151))[2]).toEqual({ t: new Date(sec(120)).toISOString(), s: 30, steps: 40 });
  });

  it("drops minutes with no active time", () => {
    expect(toSamples([{ minute: sec(600), steps: 50 }], [{ from: sec(0), to: sec(60), open: false }], sec(900))).toEqual([]);
  });
});

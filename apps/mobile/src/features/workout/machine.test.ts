import { describe, expect, it } from "vitest";
import { activeSeconds, canApply, formatDuration, nextEventTime, stateOf, type LocalEvent } from "./machine";

const ev = (kind: LocalEvent["kind"], sec: number): LocalEvent => ({ id: kind + sec, kind, at: sec * 1000 });

describe("stateOf / canApply", () => {
  it("follows the server's transitions", () => {
    const events = [ev("start", 0), ev("pause", 60)];
    expect(stateOf(events)).toBe("paused");
    expect(canApply(events, "resume")).toBe(true);
    expect(canApply(events, "pause")).toBe(false);
    expect(stateOf([...events, ev("finish", 90)])).toBe("finished");
    expect(canApply([...events, ev("finish", 90)], "resume")).toBe(false);
  });
});

describe("activeSeconds", () => {
  it("excludes paused time and counts an open run up to now", () => {
    const events = [ev("start", 0), ev("pause", 600), ev("resume", 1200)];
    expect(activeSeconds(events, 1800 * 1000)).toBe(1200);
  });
  it("stops at finish", () => {
    expect(activeSeconds([ev("start", 0), ev("finish", 300)], 9_999_000)).toBe(300);
  });
  it("matches the server test: start, pause at 10 min, resume at once, finish at 30 min → 1800 s", () => {
    expect(activeSeconds([ev("start", 0), ev("pause", 600), ev("resume", 600), ev("finish", 1800)], 0)).toBe(1800);
  });
});

describe("nextEventTime", () => {
  it("never goes backwards when the phone clock jumps", () => {
    expect(nextEventTime([ev("start", 100)], 50_000)).toBe(100_000);
    expect(nextEventTime([ev("start", 100)], 200_000)).toBe(200_000);
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(754)).toBe("12:34");
    expect(formatDuration(3723)).toBe("1:02:03");
  });
});

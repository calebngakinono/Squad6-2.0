import { TRACKING_RULES, type MotionSample } from "@squad-six/shared";
import type { Interval } from "./track";

// Steps are kept per clock minute (the server's format). Pure helpers, unit-tested.

const MINUTE = 60_000;
export const minuteOf = (t: number) => Math.floor(t / MINUTE) * MINUTE;

export type StepPiece = { minute: number; from: number; to: number };

/**
 * Active time after `cursor`, cut at clock-minute boundaries, for asking the phone "how many steps
 * between from and to?". For a still-running stretch only whole elapsed minutes are returned; the rest
 * is returned by a later call, once the minute is over or the stretch has ended.
 */
export function stepPieces(intervals: readonly Interval[], cursor: number, now: number): StepPiece[] {
  const pieces: StepPiece[] = [];
  for (const i of intervals) {
    let from = Math.max(i.from, cursor);
    const end = i.open ? minuteOf(now) : i.to;
    while (from < end) {
      const to = Math.min(end, minuteOf(from) + MINUTE);
      pieces.push({ minute: minuteOf(from), from, to });
      from = to;
    }
  }
  return pieces;
}

/** Seconds of a clock minute during which the timer was running. */
export function activeSecondsInMinute(intervals: readonly Interval[], minute: number): number {
  let ms = 0;
  for (const i of intervals) ms += Math.max(0, Math.min(i.to, minute + MINUTE) - Math.max(i.from, minute));
  return Math.min(60, Math.round(ms / 1000));
}

/** Android reports a running total since we subscribed; turn it into the steps taken since the last report. */
export function stepDelta(lastTotal: number | null, total: number): number {
  if (lastTotal === null || total < lastTotal) return Math.max(0, total);
  return total - lastTotal;
}

/** Minutes that are ready to upload: over (or the workout has ended), with some active time. */
export function toSamples(
  rows: readonly { minute: number; steps: number }[],
  intervals: readonly Interval[],
  now: number,
): MotionSample[] {
  const running = intervals.some((i) => i.open);
  const out: MotionSample[] = [];
  for (const r of rows) {
    if (running && r.minute + MINUTE > now) continue; // still in progress
    const s = activeSecondsInMinute(intervals, r.minute);
    if (s < 1) continue;
    out.push({ t: new Date(r.minute).toISOString(), s, steps: Math.min(TRACKING_RULES.maxStepsPerMinute, Math.round(r.steps)) });
  }
  return out;
}

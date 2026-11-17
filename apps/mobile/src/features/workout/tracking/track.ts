import { TRACKING_RULES } from "@squad-six/shared";
import type { Activity, LocalEvent } from "../machine";

// Live distance on the phone. This mirrors the server's refresh_workout_metrics() rule for rule, so
// the number on the live screen matches the official one the server computes after the finish.
// Pure (no React Native imports), so it is unit-tested, and the integration test compares it with
// the server on the same points.

export type TrackPoint = {
  t: number; // ms since epoch
  lat: number;
  lng: number;
  acc: number | null; // metres
  alt: number | null; // metres
  spd: number | null; // m/s as reported by the phone
  mock: boolean;
};

/** The parts of the phone's location reading we use (the shape expo-location delivers). */
export type RawFix = {
  timestamp: number;
  mocked?: boolean;
  coords: { latitude: number; longitude: number; accuracy: number | null; altitude: number | null; speed: number | null };
};

const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Turns a phone reading into a point. Phones report "unknown" as null or a negative number: both become null. */
export function normalizeFix(raw: RawFix): TrackPoint | null {
  const { latitude, longitude, accuracy, altitude, speed } = raw.coords;
  if (!finite(raw.timestamp) || !finite(latitude) || !finite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return {
    t: Math.round(raw.timestamp),
    lat: latitude,
    lng: longitude,
    acc: finite(accuracy) && accuracy >= 0 ? accuracy : null,
    alt: finite(altitude) && altitude >= -500 && altitude <= 9000 ? altitude : null,
    spd: finite(speed) && speed >= 0 ? speed : null,
    mock: raw.mocked === true,
  };
}

/** A stretch when the timer was running. */
export type Interval = { from: number; to: number; open: boolean };

/** Start/resume → next pause/finish/cancel. A still-running stretch ends at `now`. */
export function activeIntervals(events: readonly LocalEvent[], now: number): Interval[] {
  const out: Interval[] = [];
  let runningSince: number | null = null;
  for (const e of events) {
    if (e.kind === "start" || e.kind === "resume") runningSince ??= e.at;
    else if (runningSince !== null) {
      out.push({ from: runningSince, to: e.at, open: false });
      runningSince = null;
    }
  }
  if (runningSince !== null) out.push({ from: runningSince, to: Math.max(now, runningSince), open: true });
  return out;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const h =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, h)));
}

export type TrackTotals = {
  distanceM: number;
  excludedM: number;
  coveredSeconds: number;
  goodPoints: number;
  anchor: { t: number; lat: number; lng: number; interval: number } | null;
  previous: { t: number; interval: number } | null;
};

export const emptyTotals = (): TrackTotals => ({
  distanceM: 0,
  excludedM: 0,
  coveredSeconds: 0,
  goodPoints: 0,
  anchor: null,
  previous: null,
});

export const maxSpeedFor = (activity: Activity) =>
  activity === "cycle" ? TRACKING_RULES.maxSpeedMs.cycle : TRACKING_RULES.maxSpeedMs.default;

/** Add one fix (in time order) to the running totals. Returns the same object when the fix doesn't count. */
export function addPoint(totals: TrackTotals, p: TrackPoint, intervals: readonly Interval[], maxSpeedMs: number): TrackTotals {
  if (p.mock || p.acc === null || p.acc > TRACKING_RULES.maxAccuracyM) return totals;
  const interval = intervals.findIndex((i) => p.t >= i.from && p.t <= i.to);
  if (interval === -1) return totals; // recorded while paused

  const next: TrackTotals = { ...totals, goodPoints: totals.goodPoints + 1, previous: { t: p.t, interval } };
  if (totals.previous?.interval === interval) {
    const gap = (p.t - totals.previous.t) / 1000;
    if (gap <= TRACKING_RULES.maxGapSeconds) next.coveredSeconds += gap;
  }

  const here = { t: p.t, lat: p.lat, lng: p.lng, interval };
  if (totals.anchor?.interval !== interval) {
    next.anchor = here; // first fix of this stretch: nothing is measured across a pause
    return next;
  }
  const d = distanceM(totals.anchor.lat, totals.anchor.lng, p.lat, p.lng);
  if (d >= TRACKING_RULES.minMoveM) {
    const seconds = (p.t - totals.anchor.t) / 1000;
    if (seconds <= 0 || d / seconds > maxSpeedMs) next.excludedM += d;
    else next.distanceM += d;
    next.anchor = here;
  }
  return next;
}

export function summarizeTrack(points: readonly TrackPoint[], intervals: readonly Interval[], activity: Activity): TrackTotals {
  const speed = maxSpeedFor(activity);
  return [...points].sort((a, b) => a.t - b.t).reduce((totals, p) => addPoint(totals, p, intervals, speed), emptyTotals());
}

// Display -----------------------------------------------------------------------------------------

/** Countries that measure road distance in miles. Until there is a units setting, follow the phone's region. */
export const usesMiles = (locale: string) => /[-_](US|GB|LR|MM)\b/i.test(locale);

const METRES_PER_MILE = 1609.344;

export function formatDistance(metres: number, miles: boolean): string {
  const value = metres / (miles ? METRES_PER_MILE : 1000);
  return `${value.toFixed(2)} ${miles ? "mi" : "km"}`;
}

/** Average pace as minutes:seconds per km or mile; null until there is enough distance to be meaningful. */
export function formatPace(metres: number, activeSeconds: number, miles: boolean): string | null {
  if (metres < 50 || activeSeconds <= 0) return null;
  const perUnit = Math.round(activeSeconds / (metres / (miles ? METRES_PER_MILE : 1000)));
  return `${Math.floor(perUnit / 60)}:${String(perUnit % 60).padStart(2, "0")} /${miles ? "mi" : "km"}`;
}

/** Average speed, for rides. */
export function formatSpeed(metres: number, activeSeconds: number, miles: boolean): string | null {
  if (metres < 50 || activeSeconds <= 0) return null;
  const perHour = (metres / (miles ? METRES_PER_MILE : 1000) / activeSeconds) * 3600;
  return `${perHour.toFixed(1)} ${miles ? "mph" : "km/h"}`;
}

// Pure GPS summary used by the device check. No React Native imports, so it is unit-tested.

export type GpsPoint = {
  timestamp: number; // ms since epoch
  latitude: number;
  longitude: number;
  accuracy: number | null; // metres
  speed: number | null; // m/s as reported by the OS
  mocked: boolean;
  inBackground: boolean;
};

export type GpsSummary = {
  points: number;
  backgroundPoints: number;
  durationSec: number;
  pointsPerMinute: number;
  medianAccuracyM: number | null;
  distanceM: number;
  maxSegmentSpeedMs: number | null;
  longestGapSec: number;
  mockedPoints: number;
};

const EARTH_RADIUS_M = 6_371_000;

export function distanceM(a: GpsPoint, b: GpsPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Points with accuracy worse than this are ignored for distance (they jump around). */
export const MAX_ACCURACY_FOR_DISTANCE_M = 30;

export function summarizeGps(input: readonly GpsPoint[]): GpsSummary {
  const points = [...input].sort((a, b) => a.timestamp - b.timestamp);
  const durationSec = points.length > 1 ? (points[points.length - 1].timestamp - points[0].timestamp) / 1000 : 0;

  let total = 0;
  let maxSpeed: number | null = null;
  let longestGap = 0;
  let prevGood: GpsPoint | null = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i > 0) longestGap = Math.max(longestGap, (p.timestamp - points[i - 1].timestamp) / 1000);
    const good = p.accuracy !== null && p.accuracy <= MAX_ACCURACY_FOR_DISTANCE_M;
    if (!good) continue;
    if (prevGood) {
      const d = distanceM(prevGood, p);
      const dt = (p.timestamp - prevGood.timestamp) / 1000;
      total += d;
      if (dt > 0) maxSpeed = Math.max(maxSpeed ?? 0, d / dt);
    }
    prevGood = p;
  }

  return {
    points: points.length,
    backgroundPoints: points.filter((p) => p.inBackground).length,
    durationSec,
    pointsPerMinute: durationSec > 0 ? (points.length / durationSec) * 60 : 0,
    medianAccuracyM: median(points.flatMap((p) => (p.accuracy === null ? [] : [p.accuracy]))),
    distanceM: total,
    maxSegmentSpeedMs: maxSpeed,
    longestGapSec: longestGap,
    mockedPoints: points.filter((p) => p.mocked).length,
  };
}

import { OWN_BUNDLE_ID, type EvidenceProvider, type PlatformEvidence } from "@squad-six/shared";

// Choosing which health-platform workout (if any) backs a Squad Six workout. Pure, so it is
// unit-tested; reading Apple Health itself lives in healthkit.ts.

/** A workout as a health platform reports it. Times in ms since epoch. */
export type PlatformWorkout = {
  provider: EvidenceProvider;
  id: string;
  sourceName: string | null;
  bundleId: string;
  deviceName: string | null;
  activity: string | null;
  start: number;
  end: number;
  userEntered: boolean;
  distanceM: number | null;
  energyKcal: number | null;
};

export type Span = { start: number; end: number };
export type HeartRateSample = { t: number; bpm: number };

/** Share of the Squad Six workout (start to finish) covered by the platform workout. */
export function overlapFraction(session: Span, workout: Span): number {
  const length = session.end - session.start;
  if (length <= 0) return 0;
  const covered = Math.min(session.end, workout.end) - Math.max(session.start, workout.start);
  return Math.max(0, Math.min(1, covered / length));
}

/**
 * The best candidate: recorded automatically by another app or device, overlapping the workout the most.
 * Hand-typed entries and Squad Six's own records never count, however well they overlap.
 */
export function pickEvidence(session: Span, candidates: readonly PlatformWorkout[]): PlatformWorkout | null {
  let best: PlatformWorkout | null = null;
  let bestOverlap = 0;
  for (const w of candidates) {
    if (w.userEntered || w.bundleId.toLowerCase() === OWN_BUNDLE_ID || w.end <= w.start) continue;
    const overlap = overlapFraction(session, w);
    if (overlap > bestOverlap) {
      best = w;
      bestOverlap = overlap;
    }
  }
  return best;
}

const METRES_PER_UNIT: Record<string, number> = { m: 1, km: 1000, mi: 1609.344, ft: 0.3048, yd: 0.9144, cm: 0.01 };

/** Distance in metres; null when the unit isn't one we know (never guessed). */
export function toMetres(quantity: number, unit: string): number | null {
  const factor = METRES_PER_UNIT[unit];
  return factor !== undefined && Number.isFinite(quantity) && quantity >= 0 ? quantity * factor : null;
}

const KCAL_PER_UNIT: Record<string, number> = { kcal: 1, Cal: 1, cal: 0.001, kJ: 1 / 4.184, J: 1 / 4184 };

export function toKcal(quantity: number, unit: string): number | null {
  const factor = KCAL_PER_UNIT[unit];
  return factor !== undefined && Number.isFinite(quantity) && quantity >= 0 ? quantity * factor : null;
}

export type HeartRateSummary = { samples: number; minutes: number; min: number; avg: number; max: number };

/** Heart rate inside `span`: how many samples, how many distinct minutes they cover, and the range. */
export function summarizeHeartRate(samples: readonly HeartRateSample[], span: Span): HeartRateSummary | null {
  const minutes = new Set<number>();
  let count = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const s of samples) {
    if (s.t < span.start || s.t > span.end || !Number.isFinite(s.bpm) || s.bpm < 25 || s.bpm > 250) continue;
    count++;
    sum += s.bpm;
    min = Math.min(min, s.bpm);
    max = Math.max(max, s.bpm);
    minutes.add(Math.floor(s.t / 60_000));
  }
  if (count === 0) return null;
  const round = (v: number) => Math.round(v * 10) / 10;
  return { samples: count, minutes: Math.min(720, minutes.size), min: round(min), avg: round(sum / count), max: round(max) };
}

const clip = (v: string | null, max: number) => (v === null ? null : v.slice(0, max));

/** The summary sent to the server. */
export function toEvidence(workout: PlatformWorkout, heartRate: HeartRateSummary | null): PlatformEvidence {
  return {
    provider: workout.provider,
    id: workout.id,
    source_name: clip(workout.sourceName, 100),
    bundle_id: workout.bundleId,
    device_name: clip(workout.deviceName, 100),
    activity: clip(workout.activity, 60),
    start: new Date(workout.start).toISOString(),
    end: new Date(workout.end).toISOString(),
    user_entered: workout.userEntered,
    distance_m: workout.distanceM === null ? null : Math.round(workout.distanceM * 10) / 10,
    energy_kcal: workout.energyKcal === null ? null : Math.round(workout.energyKcal * 10) / 10,
    hr_samples: heartRate?.samples ?? null,
    hr_minutes: heartRate?.minutes ?? null,
    hr_min: heartRate?.min ?? null,
    hr_avg: heartRate?.avg ?? null,
    hr_max: heartRate?.max ?? null,
  };
}

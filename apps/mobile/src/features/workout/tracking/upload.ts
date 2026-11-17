import { motionSampleSchema, routePointSchema, TRACKING_RULES, type MotionSample, type RoutePoint } from "@squad-six/shared";
import { TransportError } from "../queue";
import type { TrackingStore } from "./local-store";
import { toSamples } from "./steps";
import type { Interval, TrackPoint } from "./track";

// Sends buffered GPS fixes and steps to the server in batches. Safe to repeat: the server ignores a
// fix it already has and keeps the larger step count for a minute. Pure: the network is injected.

export interface TrackingApi {
  sendPoints(serverSessionId: string, points: RoutePoint[]): Promise<void>;
  sendSteps(serverSessionId: string, samples: MotionSample[]): Promise<void>;
}

export type UploadResult = {
  /** Nothing is waiting on the phone any more. */
  complete: boolean;
  /** The server refused some measurements (they were dropped): its error code. */
  rejected: string | null;
};

const toWire = (p: TrackPoint) => ({ t: new Date(p.t).toISOString(), lat: p.lat, lng: p.lng, acc: p.acc, alt: p.alt, spd: p.spd, mock: p.mock });

const isRejection = (e: unknown): e is TransportError => e instanceof TransportError && e.kind === "rejected";

/** Step minutes that are ready to send and have changed since they were last sent. */
function pendingSteps(store: TrackingStore, session: string, intervals: readonly Interval[], now: number) {
  const rows = store.stepRows(session).filter((r) => r.steps > r.sentSteps);
  const samples = toSamples(rows, intervals, now).filter((s) => motionSampleSchema.safeParse(s).success);
  const ready = new Set(samples.map((s) => Date.parse(s.t)));
  return { samples, rows: rows.filter((r) => ready.has(r.minute)) };
}

export function hasPendingTracking(store: TrackingStore, session: string, intervals: readonly Interval[], now: number): boolean {
  return store.unsentPoints(session, 1).length > 0 || pendingSteps(store, session, intervals, now).samples.length > 0;
}

export async function uploadTracking(
  store: TrackingStore,
  session: string,
  serverSessionId: string,
  intervals: readonly Interval[],
  now: number,
  api: TrackingApi,
): Promise<UploadResult> {
  let rejected: string | null = null;

  for (;;) {
    const batch = store.unsentPoints(session, TRACKING_RULES.maxPointsPerUpload);
    if (batch.length === 0) break;
    const valid = batch.map(toWire).filter((p) => routePointSchema.safeParse(p).success);
    try {
      if (valid.length > 0) await api.sendPoints(serverSessionId, valid);
    } catch (e) {
      if (!isRejection(e)) return { complete: false, rejected }; // no connection: keep everything for later
      rejected = e.code;
      if (e.code !== "invalid_points") {
        // The workout no longer takes location (closed, cancelled, wrong activity): stop keeping it.
        for (let rest = batch; rest.length > 0; rest = store.unsentPoints(session, TRACKING_RULES.maxPointsPerUpload)) {
          store.markPointsSent(session, rest.map((p) => p.t));
        }
        break;
      }
    }
    store.markPointsSent(session, batch.map((p) => p.t));
  }

  const steps = pendingSteps(store, session, intervals, now);
  for (let i = 0; i < steps.samples.length; i += TRACKING_RULES.maxSamplesPerUpload) {
    try {
      await api.sendSteps(serverSessionId, steps.samples.slice(i, i + TRACKING_RULES.maxSamplesPerUpload));
    } catch (e) {
      if (!isRejection(e)) return { complete: false, rejected };
      rejected = e.code;
    }
  }
  store.markStepsSent(session, steps.rows);

  return { complete: !hasPendingTracking(store, session, intervals, now), rejected };
}

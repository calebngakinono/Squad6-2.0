import type { TrackPoint } from "./track";

// Where measurements wait on the phone until they reach the server. The real implementation is a
// small SQLite file (local-store.sqlite.ts); this in-memory one backs the unit tests.

export type StepRow = { minute: number; steps: number; sentSteps: number };

export interface TrackingStore {
  /** Saves fixes; a fix at an instant that is already stored is ignored. */
  addPoints(session: string, points: readonly TrackPoint[]): void;
  allPoints(session: string): TrackPoint[];
  unsentPoints(session: string, limit: number): TrackPoint[];
  markPointsSent(session: string, times: readonly number[]): void;
  /** Adds steps to a clock minute. */
  addSteps(session: string, minute: number, steps: number): void;
  stepRows(session: string): StepRow[];
  markStepsSent(session: string, rows: readonly { minute: number; steps: number }[]): void;
  clear(session: string): void;
  /** Removes anything recorded before `t` (left behind by a workout that was never cleared). */
  purgeOlderThan(t: number): void;
}

export function createMemoryStore(): TrackingStore {
  const points = new Map<string, Map<number, TrackPoint & { sent: boolean }>>();
  const steps = new Map<string, Map<number, StepRow>>();
  const pointsOf = (s: string) => points.get(s) ?? points.set(s, new Map()).get(s)!;
  const stepsOf = (s: string) => steps.get(s) ?? steps.set(s, new Map()).get(s)!;
  const ordered = (s: string) => [...pointsOf(s).values()].sort((a, b) => a.t - b.t);
  const strip = ({ sent: _sent, ...p }: TrackPoint & { sent: boolean }): TrackPoint => p;

  return {
    addPoints(session, incoming) {
      const map = pointsOf(session);
      for (const p of incoming) if (!map.has(p.t)) map.set(p.t, { ...p, sent: false });
    },
    allPoints: (session) => ordered(session).map(strip),
    unsentPoints: (session, limit) => ordered(session).filter((p) => !p.sent).slice(0, limit).map(strip),
    markPointsSent(session, times) {
      const map = pointsOf(session);
      for (const t of times) {
        const p = map.get(t);
        if (p) p.sent = true;
      }
    },
    addSteps(session, minute, count) {
      const map = stepsOf(session);
      const row = map.get(minute) ?? { minute, steps: 0, sentSteps: 0 };
      map.set(minute, { ...row, steps: row.steps + count });
    },
    stepRows: (session) => [...stepsOf(session).values()].sort((a, b) => a.minute - b.minute),
    markStepsSent(session, rows) {
      const map = stepsOf(session);
      for (const r of rows) {
        const row = map.get(r.minute);
        if (row) map.set(r.minute, { ...row, sentSteps: Math.max(row.sentSteps, r.steps) });
      }
    },
    clear(session) {
      points.delete(session);
      steps.delete(session);
    },
    purgeOlderThan(t) {
      for (const map of points.values()) for (const k of [...map.keys()]) if (k < t) map.delete(k);
      for (const map of steps.values()) for (const k of [...map.keys()]) if (k < t) map.delete(k);
    },
  };
}

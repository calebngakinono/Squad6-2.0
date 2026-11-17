import type { MotionSample, RoutePoint } from "@squad-six/shared";
import { describe, expect, it } from "vitest";
import { TransportError } from "../queue";
import { createMemoryStore } from "./local-store";
import type { Interval, TrackPoint } from "./track";
import { hasPendingTracking, uploadTracking, type TrackingApi } from "./upload";

const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const sec = (n: number) => T0 + n * 1000;
const point = (n: number, extra: Partial<TrackPoint> = {}): TrackPoint => ({ t: sec(n), lat: 40 + n * 0.00003, lng: -111, acc: 5, alt: null, spd: null, mock: false, ...extra });
const ended: Interval[] = [{ from: sec(0), to: sec(3000), open: false }];

function fakeApi(fail?: (call: number, kind: "points" | "steps") => Error | null) {
  const points: RoutePoint[][] = [];
  const steps: MotionSample[][] = [];
  let calls = 0;
  const api: TrackingApi = {
    async sendPoints(_id, batch) {
      const error = fail?.(++calls, "points");
      if (error) throw error;
      points.push(batch);
    },
    async sendSteps(_id, batch) {
      const error = fail?.(++calls, "steps");
      if (error) throw error;
      steps.push(batch);
    },
  };
  return { api, points, steps };
}

describe("uploadTracking", () => {
  it("sends points in batches of 500 and steps, then has nothing left", async () => {
    const store = createMemoryStore();
    store.addPoints("s", Array.from({ length: 1200 }, (_, i) => point(i)));
    store.addSteps("s", sec(0), 150);
    const { api, points, steps } = fakeApi();

    const result = await uploadTracking(store, "s", "server-id", ended, sec(4000), api);

    expect(result).toEqual({ complete: true, rejected: null });
    expect(points.map((b) => b.length)).toEqual([500, 500, 200]);
    expect(points[0][0]).toMatchObject({ t: new Date(sec(0)).toISOString(), lat: 40, mock: false });
    expect(steps).toEqual([[{ t: new Date(sec(0)).toISOString(), s: 60, steps: 150 }]]);
    expect(store.allPoints("s")).toHaveLength(1200); // kept on the phone for the live display
    expect(hasPendingTracking(store, "s", ended, sec(4000))).toBe(false);
  });

  it("keeps everything when the connection drops, and resumes where it stopped", async () => {
    const store = createMemoryStore();
    store.addPoints("s", Array.from({ length: 700 }, (_, i) => point(i)));
    const offline = fakeApi((call) => (call === 2 ? new TransportError("network", "fetch failed") : null));

    expect(await uploadTracking(store, "s", "id", ended, sec(4000), offline.api)).toEqual({ complete: false, rejected: null });
    expect(store.unsentPoints("s", 1000)).toHaveLength(200);

    const online = fakeApi();
    expect((await uploadTracking(store, "s", "id", ended, sec(4000), online.api)).complete).toBe(true);
    expect(online.points.map((b) => b.length)).toEqual([200]);
  });

  it("never sends a reading the server would refuse", async () => {
    const store = createMemoryStore();
    store.addPoints("s", [point(1), point(2, { lat: 95 }), point(3, { acc: -4 }), point(4)]);
    const { api, points } = fakeApi();
    expect((await uploadTracking(store, "s", "id", ended, sec(4000), api)).complete).toBe(true);
    expect(points[0].map((p) => p.t)).toEqual([new Date(sec(1)).toISOString(), new Date(sec(4)).toISOString()]);
  });

  it("stops keeping location once the server no longer accepts it", async () => {
    const store = createMemoryStore();
    store.addPoints("s", Array.from({ length: 700 }, (_, i) => point(i)));
    const { api } = fakeApi(() => new TransportError("rejected", "tracking_window_closed"));
    expect(await uploadTracking(store, "s", "id", ended, sec(4000), api)).toEqual({ complete: true, rejected: "tracking_window_closed" });
  });

  it("only re-sends a minute of steps when it has grown, and waits for the minute in progress", async () => {
    const store = createMemoryStore();
    const running: Interval[] = [{ from: sec(0), to: sec(90), open: true }];
    store.addSteps("s", sec(0), 100);
    store.addSteps("s", sec(60), 40);
    const first = fakeApi();
    await uploadTracking(store, "s", "id", running, sec(90), first.api);
    expect(first.steps).toEqual([[{ t: new Date(sec(0)).toISOString(), s: 60, steps: 100 }]]);

    const again = fakeApi();
    await uploadTracking(store, "s", "id", running, sec(100), again.api);
    expect(again.steps).toEqual([]);

    store.addSteps("s", sec(60), 60);
    const later = fakeApi();
    await uploadTracking(store, "s", "id", [{ from: sec(0), to: sec(110), open: false }], sec(200), later.api);
    expect(later.steps).toEqual([[{ t: new Date(sec(60)).toISOString(), s: 50, steps: 100 }]]);
  });
});

import type { Database } from "@squad-six/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { matchAndAttach, type EvidenceProvider } from "./evidence/attach";
import type { PlatformWorkout } from "./evidence/match";
import { drain, type Command } from "./queue";
import { createMemoryStore } from "./tracking/local-store";
import { activeIntervals, summarizeTrack, type TrackPoint } from "./tracking/track";
import { uploadTracking } from "./tracking/upload";

// The real transport + queue against a LOCAL Supabase only (see squads/api.integration.test.ts).
const url = process.env.SQUADS_IT_URL;
const key = process.env.SQUADS_IT_KEY;
const isLocal = !!url && /^http:\/\/(127\.0\.0\.1|localhost)/.test(url);

const current: { client: SupabaseClient<Database> | null } = { client: null };
vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return current.client;
  },
}));

const uuid = () => crypto.randomUUID();

describe.skipIf(!isLocal)("workout transport against local Supabase", () => {
  let transport: typeof import("./transport");
  beforeAll(async () => {
    transport = await import("./transport");
    const client = createClient<Database>(url!, key!, { auth: { persistSession: false } });
    const { data } = await client.auth.signUp({ email: `wk-${Date.now()}@example.com`, password: "test-password-123" });
    current.client = client;
    await client.rpc("complete_onboarding", {
      flow_version: 2,
      answers: {},
      display_name: "W",
      city_id: 5419384,
      home_timezone: "America/Denver",
      weekly_commitment: 3,
    });
    expect(data.user).toBeTruthy();
  });

  it("syncs a queued strength workout, survives a lost response, and recovers from the server", async () => {
    const t = transport.createTransport("test-device");
    const cid = uuid();
    const now = Date.now();
    const setId = uuid();
    const pauseId = uuid();
    const queue: Command[] = [
      { type: "start", id: cid, clientSessionId: cid, activity: "strength", at: now - 20 * 60_000 },
      { type: "log_set", id: setId, clientSessionId: cid, exercise: "Squat", reps: 5, weightKg: 100, at: now - 15 * 60_000 },
      { type: "transition", id: pauseId, clientSessionId: cid, kind: "pause", at: now - 10 * 60_000 },
    ];
    let r = await drain(queue, { sessions: {}, sets: {} }, t);
    expect(r.rejected).toEqual([]);
    expect(r.context.sessions[cid]).toMatchObject({ state: "paused", version: 2 });

    // Recovery: what a fresh install would load.
    const open = await transport.fetchOpenWorkout();
    expect(open?.session.client_session_id).toBe(cid);
    expect(open?.events.map((e) => e.kind)).toEqual(["start", "pause"]);
    expect(open?.sets.map((s) => s.client_set_id)).toEqual([setId]);

    // The phone lost the pause response and re-sends it with the old version: no error, no duplicate.
    r = await drain(
      [{ type: "transition", id: pauseId, clientSessionId: cid, kind: "pause", at: now - 10 * 60_000 }],
      { sessions: { [cid]: { ...r.context.sessions[cid], version: 1 } }, sets: r.context.sets },
      t,
    );
    expect(r.rejected).toEqual([]);

    r = await drain(
      [
        { type: "transition", id: uuid(), clientSessionId: cid, kind: "resume", at: now - 5 * 60_000 },
        { type: "transition", id: uuid(), clientSessionId: cid, kind: "finish", at: now },
      ],
      r.context,
      t,
    );
    expect(r.context.sessions[cid]).toMatchObject({ state: "submitted" });
    // 20 → 10 min ago active (600 s) + 5 → 0 min ago active (300 s), give or take request timing.
    expect(r.context.sessions[cid].active_seconds).toBeGreaterThanOrEqual(899);
    expect(r.context.sessions[cid].active_seconds).toBeLessThanOrEqual(905);
    expect(await transport.fetchOpenWorkout()).toBeNull();
    // Scoring is switched off by default, so there is no score to show (never a made-up one).
    expect(await transport.fetchWorkoutScore(r.context.sessions[cid].id)).toBeNull();
  });

  it("uploads a GPS track and steps, and the server's distance matches the phone's live number", async () => {
    const t = transport.createTransport("test-device");
    const cid = uuid();
    const minute = 60_000;
    const start = Math.floor(Date.now() / minute) * minute - 20 * minute;
    const pauseAt = start + 8 * minute;
    const resumeAt = start + 12 * minute;
    const finishAt = start + 18 * minute;
    const events = [
      { id: cid, kind: "start" as const, at: start },
      { id: uuid(), kind: "pause" as const, at: pauseAt },
      { id: uuid(), kind: "resume" as const, at: resumeAt },
      { id: uuid(), kind: "finish" as const, at: finishAt },
    ];
    let r = await drain(
      [
        { type: "start", id: cid, clientSessionId: cid, activity: "run", at: start },
        { type: "transition", id: events[1].id, clientSessionId: cid, kind: "pause", at: pauseAt },
        { type: "transition", id: events[2].id, clientSessionId: cid, kind: "resume", at: resumeAt },
      ],
      { sessions: {}, sets: {} },
      t,
    );
    expect(r.rejected).toEqual([]);
    const serverId = r.context.sessions[cid].id;

    // A wobbly 7-minute jog, a walk around during the pause, a mocked stretch, a GPS jump, then 5 more minutes.
    const fix = (at: number, lat: number, lng: number, extra: Partial<TrackPoint> = {}): TrackPoint => ({ t: at, lat, lng, acc: 6, alt: 800, spd: 3, mock: false, ...extra });
    const points: TrackPoint[] = [];
    for (let i = 0; i < 420; i++) points.push(fix(start + 30_000 + i * 1000, 37.1 + i * 0.00003, -113.5 + Math.sin(i / 9) * 0.00002));
    for (let i = 0; i < 120; i++) points.push(fix(pauseAt + 30_000 + i * 1000, 37.2 + i * 0.00002, -113.5));
    for (let i = 0; i < 30; i++) points.push(fix(resumeAt + 5000 + i * 1000, 37.3 + i * 0.00003, -113.5, { mock: true }));
    points.push(fix(resumeAt + 40_000, 37.1126, -113.5), fix(resumeAt + 41_000, 38.5, -113.5));
    for (let i = 0; i < 300; i++) points.push(fix(resumeAt + 45_000 + i * 1000, 37.1126 + i * 0.000028, -113.5 + Math.cos(i / 7) * 0.00002));

    const local = createMemoryStore();
    local.addPoints(cid, points);
    for (let m = 0; m < 18; m++) local.addSteps(cid, start + m * minute, 150);

    // Upload while the workout is still open: stored, but nothing official yet.
    const open = activeIntervals(events.slice(0, 3), finishAt);
    expect(await uploadTracking(local, cid, serverId, open, finishAt, transport.trackingApi)).toEqual({ complete: true, rejected: null });
    expect(await transport.fetchWorkoutMetrics(serverId)).toEqual([]);
    // Two fixes that only reach the server after the finish (the phone was offline at the end).
    const late = [fix(finishAt - 3000, 37.1211, -113.5), fix(finishAt - 1000, 37.12116, -113.5)];
    points.push(...late);
    local.addPoints(cid, late);

    r = await drain([{ type: "transition", id: events[3].id, clientSessionId: cid, kind: "finish", at: finishAt }], r.context, t);
    expect(r.context.sessions[cid]).toMatchObject({ state: "submitted", active_seconds: 14 * 60 });
    const closed = activeIntervals(events, Date.now());
    expect(await uploadTracking(local, cid, serverId, closed, Date.now(), transport.trackingApi)).toEqual({ complete: true, rejected: null });

    const metrics = Object.fromEntries((await transport.fetchWorkoutMetrics(serverId)).map((m) => [m.metric, m]));
    const phone = summarizeTrack(points, closed, "run");
    expect(phone.distanceM).toBeGreaterThan(2000);
    expect(Math.abs(metrics.distance_m.value - phone.distanceM)).toBeLessThan(0.5);
    expect(metrics.distance_m).toMatchObject({ source: "gps", provenance: "live" });
    expect(metrics.gps_points.value).toBe(phone.goodPoints);
    expect(metrics.gps_mocked_points.value).toBe(30);
    expect(Math.abs(metrics.gps_excluded_m.value - phone.excludedM)).toBeLessThan(1);
    expect(metrics.gps_coverage.value).toBeCloseTo(phone.coveredSeconds / (14 * 60), 2);
    // 18 clock minutes sent; the 4 fully inside the pause don't count.
    expect(metrics.steps).toMatchObject({ value: 14 * 150, source: "pedometer", provenance: "live" });

    // Only the owner can read the route back.
    const mine = await current.client!.from("workout_route_points").select("recorded_at", { count: "exact", head: true }).eq("session_id", serverId);
    expect(mine.count).toBe(points.length);
    const stranger = createClient<Database>(url!, key!, { auth: { persistSession: false } });
    await stranger.auth.signUp({ email: `wk-other-${Date.now()}@example.com`, password: "test-password-123" });
    const theirs = await stranger.from("workout_route_points").select("recorded_at", { count: "exact", head: true }).eq("session_id", serverId);
    expect(theirs.count).toBe(0);
  });

  it("attaches a matching Apple Health workout once, labeled as synced, and never a hand-typed one", async () => {
    const t = transport.createTransport("test-device");
    const start = Date.now() - 30 * 60_000;
    const end = Date.now() - 60_000;
    const finishWorkout = async () => {
      const cid = uuid();
      const r = await drain(
        [
          { type: "start", id: cid, clientSessionId: cid, activity: "strength", at: start },
          { type: "transition", id: uuid(), clientSessionId: cid, kind: "finish", at: end },
        ],
        { sessions: {}, sets: {} },
        t,
      );
      expect(r.context.sessions[cid].state).toBe("submitted");
      return r.context.sessions[cid].id;
    };
    const serverId = await finishWorkout();
    expect((await transport.fetchWorkoutsAwaitingEvidence()).map((s) => s.id)).toContain(serverId);

    const watch: PlatformWorkout = {
      provider: "healthkit", id: `HK-${uuid()}`, sourceName: "Test Watch", bundleId: "com.apple.health.test", deviceName: "Apple Watch",
      activity: "traditionalStrengthTraining", start: start + 60_000, end: end - 60_000, userEntered: false, distanceM: null, energyKcal: 240.5,
    };
    const typed: PlatformWorkout = { ...watch, id: `HK-${uuid()}`, start, end, userEntered: true };
    const health = (workouts: PlatformWorkout[]): EvidenceProvider => ({
      findWorkouts: async () => workouts,
      heartRate: async (span) => Array.from({ length: 20 }, (_, i) => ({ t: span.start + i * 60_000, bpm: 110 + i })),
    });
    const span = { start, end };
    const attach = (id: string) => (e: Parameters<typeof transport.attachEvidence>[1]) => transport.attachEvidence(id, e);

    expect(await matchAndAttach(span, health([typed]), attach(serverId))).toEqual({ status: "none" });
    expect(await matchAndAttach(span, health([typed, watch]), attach(serverId))).toEqual({ status: "attached" });
    expect(await matchAndAttach(span, health([typed, watch]), attach(serverId))).toEqual({ status: "attached" }); // retry

    const [evidence] = await transport.fetchEvidence(serverId);
    expect(evidence).toMatchObject({ provider: "healthkit", source_name: "Test Watch", hr_avg: 119.5 });
    expect(evidence.overlap).toBeGreaterThan(0.9);
    const synced = (await transport.fetchWorkoutMetrics(serverId)).filter((m) => m.source === "healthkit");
    expect(synced.map((m) => m.metric).sort()).toEqual(["active_energy_kcal", "avg_heart_rate", "hr_coverage", "max_heart_rate", "platform_overlap"]);
    expect(synced.every((m) => m.provenance === "synced")).toBe(true);
    expect((await transport.fetchWorkoutsAwaitingEvidence()).map((s) => s.id)).not.toContain(serverId);

    // The same watch workout cannot back a second Squad Six workout.
    const second = await finishWorkout();
    expect(await matchAndAttach(span, health([watch]), attach(second))).toEqual({ status: "none" });
    expect(await transport.fetchEvidence(second)).toEqual([]);
  });

  it("reads season standings through the app's API (empty while scoring is off, never an error)", async () => {
    const standings = await import("@/features/standings/api");
    const season = new Date().getFullYear();
    expect(await standings.loadAthleteStandings(season, null)).toEqual([]);
    expect(await standings.loadAthleteStandings(season, "Denver")).toEqual([]);
    expect(await standings.loadSquadStandings(season, null)).toEqual([]);
    expect(await standings.loadMySeason(season)).toBeNull();
  });

  it("classifies a server refusal as rejected", async () => {
    const t = transport.createTransport("test-device");
    const cid = uuid();
    await drain([{ type: "start", id: cid, clientSessionId: cid, activity: "run", at: Date.now() }], { sessions: {}, sets: {} }, t);
    const other = uuid();
    const r = await drain([{ type: "start", id: other, clientSessionId: other, activity: "run", at: Date.now() }], { sessions: {}, sets: {} }, t);
    expect(r.rejected.map((x) => x.code)).toEqual(["active_workout_exists"]);
  });
});

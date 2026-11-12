import type { Database } from "@squad-six/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { drain, type Command } from "./queue";

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
      flow_version: 1,
      answers: {},
      display_name: "W",
      city: "Denver",
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

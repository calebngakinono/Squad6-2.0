import { describe, expect, it } from "vitest";
import { drain, TransportError, type Command, type ServerSession, type Transport } from "./queue";

// A fake server with the same rules as the database: idempotent ids, version checks, state machine.
function fakeServer() {
  const sessions = new Map<string, ServerSession>();
  const seenEvents = new Set<string>();
  const sets = new Map<string, string>();
  let offline = false;
  const calls: string[] = [];
  const net = () => {
    if (offline) throw new TransportError("network", "offline");
  };
  const next: Record<string, Record<string, string>> = {
    active: { pause: "paused", finish: "submitted", cancel: "abandoned" },
    paused: { resume: "active", finish: "submitted", cancel: "abandoned" },
  };
  const t: Transport = {
    async start(cmd) {
      net();
      calls.push("start");
      const existing = [...sessions.values()].find((s) => s.id === "srv-" + cmd.clientSessionId);
      if (existing) return existing;
      const s = { id: "srv-" + cmd.clientSessionId, version: 1, state: "active", active_seconds: null, started_at: "t", ended_at: null };
      sessions.set(s.id, s);
      return s;
    },
    async transition(session, cmd) {
      net();
      calls.push(cmd.kind);
      const s = sessions.get(session.id)!;
      if (seenEvents.has(cmd.id)) return s;
      const to = next[s.state]?.[cmd.kind];
      if (!to) throw new TransportError("rejected", "invalid_transition");
      if (session.version !== s.version) throw new TransportError("rejected", "version_conflict");
      seenEvents.add(cmd.id);
      const updated = { ...s, state: to, version: s.version + 1 };
      sessions.set(s.id, updated);
      return updated;
    },
    async logSet(_session, cmd) {
      net();
      calls.push("set");
      if (!sets.has(cmd.id)) sets.set(cmd.id, "set-" + cmd.id);
      return sets.get(cmd.id)!;
    },
    async deleteSet(_s, id) {
      net();
      calls.push("delete " + id);
    },
    async fetchSession(id) {
      net();
      return sessions.get(id) ?? null;
    },
  };
  return {
    t,
    calls,
    sessions,
    goOffline: (v: boolean) => {
      offline = v;
    },
  };
}

const start: Command = { type: "start", id: "c1", clientSessionId: "c1", activity: "strength", at: 0 };
const tr = (id: string, kind: "pause" | "resume" | "finish" | "cancel"): Command => ({
  type: "transition",
  id,
  clientSessionId: "c1",
  kind,
  at: 0,
});
const empty = { sessions: {}, sets: {} };

describe("drain", () => {
  it("sends commands in order and tracks the server session", async () => {
    const srv = fakeServer();
    const r = await drain([start, tr("e1", "pause"), tr("e2", "resume"), tr("e3", "finish")], empty, srv.t);
    expect(r.remaining).toEqual([]);
    expect(r.context.sessions.c1).toMatchObject({ state: "submitted", version: 4 });
    expect(srv.calls).toEqual(["start", "pause", "resume", "finish"]);
  });

  it("keeps everything from the first network failure and resumes later without duplicates", async () => {
    const srv = fakeServer();
    const queue = [start, tr("e1", "pause"), tr("e2", "resume")];
    let r = await drain(queue.slice(0, 1), empty, srv.t);
    srv.goOffline(true);
    r = await drain([...r.remaining, ...queue.slice(1)], r.context, srv.t);
    expect(r.remaining.map((c) => c.id)).toEqual(["e1", "e2"]);
    srv.goOffline(false);
    r = await drain(r.remaining, r.context, srv.t);
    expect(r.remaining).toEqual([]);
    expect(r.context.sessions.c1.state).toBe("active");
  });

  it("re-sending an already applied command is harmless (lost response)", async () => {
    const srv = fakeServer();
    let r = await drain([start, tr("e1", "pause")], empty, srv.t);
    // The phone never got the pause response and sends it again from its old context.
    r = await drain([tr("e1", "pause")], { sessions: { c1: { ...r.context.sessions.c1, version: 1 } }, sets: {} }, srv.t);
    expect(r.rejected).toEqual([]);
    expect(srv.sessions.get("srv-c1")!.version).toBe(2);
  });

  it("refreshes and retries once on a version conflict", async () => {
    const srv = fakeServer();
    let r = await drain([start], empty, srv.t);
    // Another device paused and resumed meanwhile.
    await srv.t.transition(r.context.sessions.c1, { ...(tr("x1", "pause") as Extract<Command, { type: "transition" }>) });
    await srv.t.transition({ ...r.context.sessions.c1, version: 2 }, { ...(tr("x2", "resume") as Extract<Command, { type: "transition" }>) });
    r = await drain([tr("e9", "finish")], r.context, srv.t);
    expect(r.rejected).toEqual([]);
    expect(r.context.sessions.c1.state).toBe("submitted");
  });

  it("drops a refused command, reports it and continues", async () => {
    const srv = fakeServer();
    const r = await drain([start, tr("e1", "resume"), tr("e2", "pause")], empty, srv.t);
    expect(r.rejected).toEqual([{ command: tr("e1", "resume"), code: "invalid_transition" }]);
    expect(r.context.sessions.c1.state).toBe("paused");
    expect(r.remaining).toEqual([]);
  });

  it("maps sets to server ids and only deletes sets the server has", async () => {
    const srv = fakeServer();
    const set: Command = { type: "log_set", id: "s1", clientSessionId: "c1", exercise: "Squat", reps: 5, weightKg: null, at: 0 };
    const r = await drain(
      [
        start,
        set,
        { type: "delete_set", id: "d1", clientSessionId: "c1", setId: "s1" },
        { type: "delete_set", id: "d2", clientSessionId: "c1", setId: "never-sent" },
      ],
      empty,
      srv.t,
    );
    expect(r.context.sets.s1).toBe("set-s1");
    expect(srv.calls).toEqual(["start", "set", "delete set-s1"]);
  });

  it("rejects follow-up commands when the start itself was refused", async () => {
    const srv = fakeServer();
    srv.t.start = async () => {
      throw new TransportError("rejected", "active_workout_exists");
    };
    const r = await drain([start, tr("e1", "pause")], empty, srv.t);
    expect(r.rejected.map((x) => x.code)).toEqual(["active_workout_exists", "workout_not_found"]);
  });
});

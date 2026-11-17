import type { Activity, EventKind } from "./machine";

// Offline-first command queue. Every button press becomes a command with its own client id, is saved
// on the phone, and is sent in order. Because the server is idempotent on those ids, re-sending after
// a crash or a lost response is always safe. Pure: the network is injected, so it is unit-tested.

export type Command =
  | { type: "start"; id: string; clientSessionId: string; activity: Activity; at: number }
  | { type: "transition"; id: string; clientSessionId: string; kind: Exclude<EventKind, "start">; at: number }
  | { type: "log_set"; id: string; clientSessionId: string; exercise: string; reps: number; weightKg: number | null; at: number }
  | { type: "delete_set"; id: string; clientSessionId: string; setId: string };

export type ServerSession = {
  id: string;
  version: number;
  state: string;
  active_seconds: number | null;
  started_at: string;
  ended_at: string | null;
};

/** What the queue has learned from the server: session per client session id, server id per client set id. */
export type SyncContext = { sessions: Record<string, ServerSession>; sets: Record<string, string> };

export class TransportError extends Error {
  constructor(
    readonly kind: "network" | "rejected",
    readonly code: string,
  ) {
    super(code);
  }
}

export interface Transport {
  start(cmd: Extract<Command, { type: "start" }>): Promise<ServerSession>;
  transition(session: ServerSession, cmd: Extract<Command, { type: "transition" }>): Promise<ServerSession>;
  logSet(session: ServerSession, cmd: Extract<Command, { type: "log_set" }>): Promise<string>;
  deleteSet(session: ServerSession, setServerId: string): Promise<void>;
  fetchSession(id: string): Promise<ServerSession | null>;
}

export type DrainResult = {
  remaining: Command[];
  context: SyncContext;
  rejected: { command: Command; code: string }[];
};

/**
 * Sends queued commands in order. Stops at the first network failure and keeps the rest for later.
 * A rejected command (the server refused it) is dropped and reported; the queue continues.
 */
export async function drain(queue: readonly Command[], context: SyncContext, transport: Transport): Promise<DrainResult> {
  const ctx: SyncContext = { sessions: { ...context.sessions }, sets: { ...context.sets } };
  const rejected: DrainResult["rejected"] = [];

  for (let i = 0; i < queue.length; i++) {
    const cmd = queue[i];
    try {
      await send(cmd, ctx, transport);
    } catch (e) {
      if (e instanceof TransportError && e.kind === "rejected") {
        rejected.push({ command: cmd, code: e.code });
        // Bring our copy of the session back in line with the server after a refusal.
        const s = ctx.sessions[cmd.clientSessionId];
        if (s) {
          const fresh = await transport.fetchSession(s.id).catch(() => null);
          if (fresh) ctx.sessions[cmd.clientSessionId] = fresh;
        }
        continue;
      }
      return { remaining: queue.slice(i), context: ctx, rejected }; // Network: try again later.
    }
  }
  return { remaining: [], context: ctx, rejected };
}

async function send(cmd: Command, ctx: SyncContext, t: Transport): Promise<void> {
  if (cmd.type === "start") {
    ctx.sessions[cmd.clientSessionId] = await t.start(cmd);
    return;
  }
  const session = ctx.sessions[cmd.clientSessionId];
  if (!session) throw new TransportError("rejected", "workout_not_found"); // Its start was refused.

  switch (cmd.type) {
    case "transition": {
      try {
        ctx.sessions[cmd.clientSessionId] = await t.transition(session, cmd);
      } catch (e) {
        if (!(e instanceof TransportError && e.code === "version_conflict")) throw e;
        // Someone (another device, or a lost response) moved the session on: refresh and retry once.
        const fresh = await t.fetchSession(session.id);
        if (!fresh) throw new TransportError("rejected", "workout_not_found");
        ctx.sessions[cmd.clientSessionId] = await t.transition(fresh, cmd);
      }
      return;
    }
    case "log_set":
      ctx.sets[cmd.id] = await t.logSet(session, cmd);
      return;
    case "delete_set": {
      const serverId = ctx.sets[cmd.setId];
      if (!serverId) return; // Never reached the server: nothing to delete there.
      await t.deleteSet(session, serverId);
      return;
    }
  }
}

import * as Crypto from "expo-crypto";
import Storage from "expo-sqlite/kv-store";
import { AppState } from "react-native";
import { activeSeconds, canApply, nextEventTime, stateOf, type Activity, type EventKind, type LocalEvent } from "./machine";
import { drain, type Command, type SyncContext } from "./queue";
import { createTransport, fetchOpenWorkout } from "./transport";

// The live workout as the phone knows it, saved to on-device storage after every change so a killed
// app comes back exactly where it was. Commands sync to the server through the queue.

export type LocalSet = { id: string; exercise: string; reps: number; weightKg: number | null; at: number; deleted: boolean };
export type LocalWorkout = { clientSessionId: string; activity: Activity; events: LocalEvent[]; sets: LocalSet[] };

type Persisted = { workout: LocalWorkout | null; queue: Command[]; context: SyncContext };

export type WorkoutSnapshot = {
  ready: boolean;
  workout: LocalWorkout | null;
  pending: number;
  syncing: boolean;
  notice: string | null;
  /** The server's copy, once synced: its times and active_seconds are the official ones. */
  server: SyncContext["sessions"][string] | null;
};

const EMPTY: Persisted = { workout: null, queue: [], context: { sessions: {}, sets: {} } };

let userId: string | null = null;
let data: Persisted = EMPTY;
let snapshot: WorkoutSnapshot = { ready: false, workout: null, pending: 0, syncing: false, notice: null, server: null };
let syncing = false;
let notice: string | null = null;
const listeners = new Set<() => void>();

const key = () => `squadsix.workout.v1.${userId}`;

function deviceId(): string {
  let id = Storage.getItemSync("squadsix.device_id");
  if (!id) {
    id = Crypto.randomUUID();
    Storage.setItemSync("squadsix.device_id", id);
  }
  return id;
}

function publish(save = true) {
  if (save && userId) Storage.setItemSync(key(), JSON.stringify(data));
  const w = data.workout;
  snapshot = {
    ready: userId !== null,
    workout: w,
    pending: data.queue.length,
    syncing,
    notice,
    server: w ? (data.context.sessions[w.clientSessionId] ?? null) : null,
  };
  listeners.forEach((fn) => fn());
}

export const workoutStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  getSnapshot: () => snapshot,
};

/** Load this account's saved workout; if there is none, ask the server for an open one (recovery). */
export async function hydrateWorkout(forUser: string) {
  if (userId !== forUser) {
    userId = forUser;
    const raw = Storage.getItemSync(key());
    data = raw ? { ...EMPTY, ...(JSON.parse(raw) as Persisted) } : EMPTY;
    notice = null;
    publish(false);
  }
  if (!data.workout) await adoptServerWorkout();
  void syncWorkout();
}

async function adoptServerWorkout() {
  try {
    const open = await fetchOpenWorkout();
    if (!open || data.workout) return;
    const { session, events, sets } = open;
    data = {
      workout: {
        clientSessionId: session.client_session_id,
        activity: session.activity as Activity,
        events: events.map((e) => ({ id: e.client_event_id, kind: e.kind as EventKind, at: Date.parse(e.effective_at) })),
        sets: sets.map((s) => ({
          id: s.client_set_id,
          exercise: s.exercise,
          reps: s.reps,
          weightKg: s.weight_kg,
          at: Date.parse(s.effective_at),
          deleted: s.deleted_at !== null,
        })),
      },
      queue: [],
      context: {
        sessions: { [session.client_session_id]: session },
        sets: Object.fromEntries(sets.map((s) => [s.client_set_id, s.id])),
      },
    };
    publish();
  } catch {
    // Offline: nothing to recover right now; the next hydrate tries again.
  }
}

function enqueue(cmd: Command) {
  data = { ...data, queue: [...data.queue, cmd] };
  publish();
  void syncWorkout();
}

export function startWorkout(activity: Activity): boolean {
  if (data.workout && !["finished", "cancelled"].includes(stateOf(data.workout.events))) return false;
  const id = Crypto.randomUUID();
  const at = Date.now();
  notice = null;
  data = { ...data, workout: { clientSessionId: id, activity, events: [{ id, kind: "start", at }], sets: [] } };
  enqueue({ type: "start", id, clientSessionId: id, activity, at });
  return true;
}

export function transitionWorkout(kind: Exclude<EventKind, "start">) {
  const w = data.workout;
  if (!w || !canApply(w.events, kind)) return;
  const event: LocalEvent = { id: Crypto.randomUUID(), kind, at: nextEventTime(w.events, Date.now()) };
  data = { ...data, workout: { ...w, events: [...w.events, event] } };
  enqueue({ type: "transition", id: event.id, clientSessionId: w.clientSessionId, kind, at: event.at });
}

export function logSet(exercise: string, reps: number, weightKg: number | null) {
  const w = data.workout;
  if (!w) return;
  const set: LocalSet = { id: Crypto.randomUUID(), exercise: exercise.trim(), reps, weightKg, at: Date.now(), deleted: false };
  data = { ...data, workout: { ...w, sets: [...w.sets, set] } };
  enqueue({ type: "log_set", id: set.id, clientSessionId: w.clientSessionId, exercise: set.exercise, reps, weightKg, at: set.at });
}

export function deleteSet(setId: string) {
  const w = data.workout;
  if (!w) return;
  data = { ...data, workout: { ...w, sets: w.sets.map((s) => (s.id === setId ? { ...s, deleted: true } : s)) } };
  enqueue({ type: "delete_set", id: Crypto.randomUUID(), clientSessionId: w.clientSessionId, setId });
}

/** Forget a finished or cancelled workout once its commands have reached the server. */
export function clearFinishedWorkout() {
  const w = data.workout;
  if (!w || data.queue.length > 0 || !["finished", "cancelled"].includes(stateOf(w.events))) return;
  data = EMPTY;
  notice = null;
  publish();
}

const MESSAGES: Record<string, string> = {
  active_workout_exists: "You already had a workout open, so we brought it back.",
  timezone_required: "Set your home time zone before starting a workout.",
  invalid_transition: "That change was already made on another device.",
  workout_not_found: "This workout no longer exists on the server.",
  set_window_closed: "Sets can't be changed after the workout is closed.",
};

export async function syncWorkout() {
  if (syncing || !userId || data.queue.length === 0) return;
  syncing = true;
  publish(false);
  const sent = data.queue;
  try {
    const result = await drain(sent, data.context, createTransport(deviceId()));
    // Keep commands added while we were sending.
    data = { ...data, queue: [...result.remaining, ...data.queue.slice(sent.length)], context: result.context };
    if (result.rejected.length > 0) {
      const code = result.rejected[0].code;
      notice = MESSAGES[code] ?? "Some changes couldn't be saved.";
      if (code === "active_workout_exists" || code === "workout_not_found") {
        // Our local workout never existed on the server: replace it with the server's truth.
        data = { ...EMPTY, context: data.context };
        await adoptServerWorkout();
      } else {
        await reloadEventsFromServer();
      }
    }
  } finally {
    syncing = false;
    publish();
  }
  if (data.queue.length > 0) scheduleRetry();
}

// After a refusal, rebuild the local timeline from the server's event log (the authority).
async function reloadEventsFromServer() {
  const open = await fetchOpenWorkout().catch(() => null);
  if (open && data.workout && open.session.client_session_id === data.workout.clientSessionId && data.queue.length === 0) {
    data = {
      ...data,
      workout: {
        ...data.workout,
        events: open.events.map((e) => ({ id: e.client_event_id, kind: e.kind as EventKind, at: Date.parse(e.effective_at) })),
      },
      context: { ...data.context, sessions: { ...data.context.sessions, [open.session.client_session_id]: open.session } },
    };
  }
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void syncWorkout();
  }, 15_000);
}

AppState.addEventListener("change", (s) => {
  if (s === "active") void syncWorkout();
});

export const liveSeconds = (w: LocalWorkout, now: number) => activeSeconds(w.events, now);

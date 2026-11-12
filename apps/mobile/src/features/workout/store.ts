import * as Crypto from "expo-crypto";
import Storage from "expo-sqlite/kv-store";
import { AppState } from "react-native";
import type { AttachedEvidence, WorkoutMetric, WorkoutScore } from "@squad-six/shared";
import { matchAndAttach } from "./evidence/attach";
import { appleHealth, appleHealthAvailable, requestAppleHealth } from "./evidence/healthkit";
import { activeSeconds, activityInfo, canApply, nextEventTime, stateOf, type Activity, type EventKind, type LocalEvent } from "./machine";
import { drain, type Command, type SyncContext } from "./queue";
import {
  collectSteps,
  onTrackPoints,
  startLocation,
  startSteps,
  stopLocation,
  stopSteps,
  trackingStore,
  type SensorStatus,
} from "./tracking/device";
import { activeIntervals, addPoint, emptyTotals, maxSpeedFor, summarizeTrack, type TrackTotals } from "./tracking/track";
import { hasPendingTracking, uploadTracking } from "./tracking/upload";
import {
  attachEvidence,
  createTransport,
  fetchEvidence,
  fetchOpenWorkout,
  fetchWorkoutMetrics,
  fetchWorkoutScore,
  fetchWorkoutsAwaitingEvidence,
  trackingApi,
} from "./transport";

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
  tracking: TrackingSnapshot;
  health: HealthSnapshot;
  /** The server's scoring outcome after the finish; null while scoring is off or not available yet. */
  score: WorkoutScore | null;
};

/** Apple Health evidence for the finished workout. */
export type HealthSnapshot = {
  /** This phone has Apple Health. */
  available: boolean;
  /** The athlete turned the integration on (permission is only asked then). */
  connected: boolean;
  /** idle: not looked yet. none: no matching workout found (so far). closed: the server no longer takes evidence. */
  status: "idle" | "checking" | "attached" | "none" | "closed";
  attached: AttachedEvidence | null;
};

/** What the phone's sensors have measured so far. Live values only: the official ones are `metrics`. */
export type TrackingSnapshot = {
  gps: SensorStatus;
  motion: SensorStatus;
  /** Measured by this phone's GPS during this workout; null when GPS isn't recording anything. */
  distanceM: number | null;
  /** Counted by this phone; null when the step counter isn't available. */
  steps: number | null;
  /** Measurements are still waiting on the phone to be uploaded. */
  pending: boolean;
  /** Computed by the server after the finish, once every measurement has arrived. */
  metrics: WorkoutMetric[] | null;
};

const EMPTY: Persisted = { workout: null, queue: [], context: { sessions: {}, sets: {} } };

let userId: string | null = null;
let data: Persisted = EMPTY;
const NO_TRACKING: TrackingSnapshot = { gps: "off", motion: "off", distanceM: null, steps: null, pending: false, metrics: null };
let snapshot: WorkoutSnapshot = {
  ready: false,
  workout: null,
  pending: 0,
  syncing: false,
  notice: null,
  server: null,
  tracking: NO_TRACKING,
  health: { available: false, connected: false, status: "idle", attached: null },
  score: null,
};
let gps: SensorStatus = "off";
let motion: SensorStatus = "off";
let totals: TrackTotals = emptyTotals();
let stepTotal = 0;
let trackingPending = false;
let metrics: WorkoutMetric[] | null = null;
let score: WorkoutScore | null = null;
let healthStatus: HealthSnapshot["status"] = "idle";
let attached: AttachedEvidence | null = null;

const healthKey = () => `squadsix.health.apple.${userId}`;
const healthConnected = () => userId !== null && Storage.getItemSync(healthKey()) === "on";
const healthSnapshot = (): HealthSnapshot => ({
  available: appleHealthAvailable(),
  connected: healthConnected(),
  status: healthStatus,
  attached,
});
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
    tracking: w
      ? {
          gps,
          motion,
          distanceM: activityInfo(w.activity).gps && (gps === "on" || totals.goodPoints > 0) ? totals.distanceM : null,
          steps: activityInfo(w.activity).steps && (motion === "on" || stepTotal > 0) ? stepTotal : null,
          pending: trackingPending,
          metrics,
        }
      : NO_TRACKING,
    health: healthSnapshot(),
    score: w ? score : null,
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
    if (userId !== null) void stopTracking(); // another account was signed in: its sensors go off
    userId = forUser;
    const raw = Storage.getItemSync(key());
    data = raw ? { ...EMPTY, ...(JSON.parse(raw) as Persisted) } : EMPTY;
    notice = null;
    resetTracking();
    trackingStore().purgeOlderThan(Date.now() - 48 * 60 * 60 * 1000);
    restoreTracking();
    publish(false);
  }
  if (!data.workout) await adoptServerWorkout();
  if (data.workout && stateOf(data.workout.events) === "active") void beginTracking();
  void syncWorkout();
  void recheckRecentEvidence();
}

// Apple Health evidence ----------------------------------------------------------------------------
// After the finish, look in Apple Health for a workout recorded by a watch or another app at the same
// time and attach its summary. Only when the athlete has turned the integration on.

/** Look for a matching Apple Health workout for the finished workout on screen. */
export async function checkHealthEvidence() {
  const w = data.workout;
  const server = w ? data.context.sessions[w.clientSessionId] : null;
  if (!w || !server?.ended_at || stateOf(w.events) !== "finished") return;
  if (!appleHealthAvailable() || !healthConnected() || healthStatus === "checking" || healthStatus === "attached") return;
  const id = w.clientSessionId;
  healthStatus = "checking";
  publish(false);
  let next: HealthSnapshot["status"] = "none";
  try {
    const span = { start: Date.parse(server.started_at), end: Date.parse(server.ended_at) };
    const outcome = await matchAndAttach(span, appleHealth, (evidence) => attachEvidence(server.id, evidence));
    next = outcome.status === "retry" ? "none" : outcome.status;
    if (outcome.status === "attached") {
      // New evidence can raise the score, so read that back too.
      const [rows, fresh, rescored] = await Promise.all([fetchEvidence(server.id), fetchWorkoutMetrics(server.id), fetchWorkoutScore(server.id)]);
      if (data.workout?.clientSessionId !== id) return;
      attached = rows.find((r) => r.provider === "healthkit") ?? null;
      metrics = fresh;
      score = rescored;
    }
  } catch {
    next = "none"; // couldn't confirm: the next check tries again
  } finally {
    if (data.workout?.clientSessionId === id) {
      healthStatus = next;
      publish(false);
    }
  }
}

/** Turn the Apple Health integration on (shows Apple's permission sheet once), then look for a match. */
export async function connectAppleHealth() {
  if (!userId || !appleHealthAvailable()) return;
  if (!(await requestAppleHealth())) return;
  Storage.setItemSync(healthKey(), "on");
  healthStatus = "idle";
  publish(false);
  await checkHealthEvidence();
}

let rechecking = false;

/** Watches can take hours to sync: when the app opens, re-check workouts from the last 24 hours. */
async function recheckRecentEvidence() {
  if (rechecking || !appleHealthAvailable() || !healthConnected()) return;
  rechecking = true;
  try {
    for (const s of await fetchWorkoutsAwaitingEvidence()) {
      await matchAndAttach({ start: s.start, end: s.end }, appleHealth, (evidence) => attachEvidence(s.id, evidence));
    }
  } catch {
    // Offline or Apple Health unavailable: the next app open tries again.
  } finally {
    rechecking = false;
  }
}

// Tracking (GPS and steps) -------------------------------------------------------------------------
// Sensors run only while the timer is running. Readings are buffered on the phone (tracking/device.ts)
// and uploaded in batches; the totals here are for the live screen only.

const intervalsNow = (w: LocalWorkout) => activeIntervals(w.events, Date.now());

function resetTracking() {
  gps = "off";
  motion = "off";
  totals = emptyTotals();
  stepTotal = 0;
  trackingPending = false;
  metrics = null;
  score = null;
  healthStatus = "idle";
  attached = null;
}

/** After an app restart: rebuild the live totals from what is buffered on the phone. */
function restoreTracking() {
  const w = data.workout;
  if (!w) return;
  const local = trackingStore();
  totals = summarizeTrack(local.allPoints(w.clientSessionId), intervalsNow(w), w.activity);
  stepTotal = local.stepRows(w.clientSessionId).reduce((sum, r) => sum + r.steps, 0);
  trackingPending = hasPendingTracking(local, w.clientSessionId, intervalsNow(w), Date.now());
}

function refreshStepTotal() {
  const w = data.workout;
  if (!w) return;
  stepTotal = trackingStore().stepRows(w.clientSessionId).reduce((sum, r) => sum + r.steps, 0);
  trackingPending = true;
  publish(false);
}

async function beginTracking() {
  const w = data.workout;
  if (!w || stateOf(w.events) !== "active") return;
  const info = activityInfo(w.activity);
  const id = w.clientSessionId;
  // Ask for motion first, then location, so the two permission prompts never overlap.
  if (info.steps) motion = await startSteps(id, refreshStepTotal);
  if (info.gps) gps = await startLocation(id, w.events[0].at);
  // The athlete may have paused or finished while a permission prompt was open.
  if (data.workout?.clientSessionId !== id || stateOf(data.workout.events) !== "active") await stopTracking();
  publish(false);
  startFlushTimer();
}

async function stopTracking() {
  stopSteps();
  await stopLocation();
}

onTrackPoints((session, points) => {
  const w = data.workout;
  if (!w || w.clientSessionId !== session) return;
  const intervals = intervalsNow(w);
  const speed = maxSpeedFor(w.activity);
  for (const p of points) totals = addPoint(totals, p, intervals, speed);
  trackingPending = true;
  publish(false);
  // Timers don't run reliably with the screen locked, but location updates keep arriving: upload from here too.
  if (Date.now() - lastFlushAt > FLUSH_EVERY_MS) void flushTracking();
});

const FLUSH_EVERY_MS = 30_000;
let lastFlushAt = 0;
let flushing = false;
let flushTimer: ReturnType<typeof setInterval> | null = null;

function startFlushTimer() {
  flushTimer ??= setInterval(() => void flushTracking(), FLUSH_EVERY_MS);
}

function stopFlushTimer() {
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
}

/** Upload buffered measurements; after the finish, read back the server's official metrics. */
async function flushTracking() {
  const w = data.workout;
  const server = w ? data.context.sessions[w.clientSessionId] : null;
  if (!w || !server || flushing) return;
  flushing = true;
  lastFlushAt = Date.now();
  try {
    const id = w.clientSessionId;
    const state = stateOf(w.events);
    if (state === "cancelled") {
      trackingStore().clear(id);
      trackingPending = false;
      return;
    }
    if (activityInfo(w.activity).steps && (await collectSteps(id, intervalsNow(w), Date.now()))) {
      stepTotal = trackingStore().stepRows(id).reduce((sum, r) => sum + r.steps, 0);
    }
    const result = await uploadTracking(trackingStore(), id, server.id, intervalsNow(w), Date.now(), trackingApi);
    if (data.workout?.clientSessionId !== id) return;
    trackingPending = !result.complete;
    // The finish itself must have reached the server before its metrics mean anything.
    if (state === "finished" && result.complete && data.queue.length === 0) {
      metrics = await fetchWorkoutMetrics(server.id).catch(() => metrics);
      score = await fetchWorkoutScore(server.id).catch(() => score);
      if (metrics) stopFlushTimer();
      if (healthStatus === "idle") void checkHealthEvidence();
    }
  } catch {
    // Unexpected failure: keep the measurements and try again on the next round.
  } finally {
    flushing = false;
    publish(false);
  }
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
  resetTracking();
  data = { ...data, workout: { clientSessionId: id, activity, events: [{ id, kind: "start", at }], sets: [] } };
  enqueue({ type: "start", id, clientSessionId: id, activity, at });
  void beginTracking();
  return true;
}

export function transitionWorkout(kind: Exclude<EventKind, "start">) {
  const w = data.workout;
  if (!w || !canApply(w.events, kind)) return;
  const event: LocalEvent = { id: Crypto.randomUUID(), kind, at: nextEventTime(w.events, Date.now()) };
  data = { ...data, workout: { ...w, events: [...w.events, event] } };
  enqueue({ type: "transition", id: event.id, clientSessionId: w.clientSessionId, kind, at: event.at });
  // Sensors follow the timer: off while paused and after the end.
  if (kind === "resume") void beginTracking();
  else void stopTracking().then(flushTracking);
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
  if (!w || data.queue.length > 0 || trackingPending || !["finished", "cancelled"].includes(stateOf(w.events))) return;
  trackingStore().clear(w.clientSessionId); // the route now lives only on the server, visible to its owner
  stopFlushTimer();
  resetTracking();
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
  if (syncing || !userId) return;
  if (data.queue.length === 0) {
    const finished = data.workout !== null && stateOf(data.workout.events) === "finished";
    if (trackingPending || (finished && metrics === null)) void flushTracking();
    return;
  }
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
        await stopTracking();
        if (data.workout) trackingStore().clear(data.workout.clientSessionId);
        resetTracking();
        data = { ...EMPTY, context: data.context };
        await adoptServerWorkout();
        if (data.workout && stateOf(data.workout.events) === "active") void beginTracking();
      } else {
        await reloadEventsFromServer();
      }
    }
  } finally {
    syncing = false;
    publish();
  }
  if (data.queue.length > 0) scheduleRetry();
  else void flushTracking();
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

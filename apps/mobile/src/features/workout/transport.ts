import {
  attachedEvidenceSchema,
  workoutMetricSchema,
  workoutScoreSchema,
  type AttachedEvidence,
  type PlatformEvidence,
  type WorkoutMetric,
  type WorkoutScore,
} from "@squad-six/shared";
import { supabase } from "@/lib/supabase";
import { TransportError, type ServerSession, type Transport } from "./queue";
import type { TrackingApi } from "./tracking/upload";

// Turns Supabase responses into the queue's two outcomes: the server refused (a database error code),
// or we couldn't reach it / the session token needs refreshing (try again later).
function classify(error: { message: string; code?: string }): TransportError {
  const code = error.code ?? "";
  const unreachable = code === "" || code.startsWith("PGRST3"); // network failure or expired token
  return new TransportError(unreachable ? "network" : "rejected", error.message);
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  // The generated types know these functions; the queue passes plain objects, so call untyped here.
  const { data, error } = await (supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: T; error: { message: string; code?: string } | null }>)(fn, args);
  if (error) throw classify(error);
  return data;
}

const SESSION_COLUMNS = "id, version, state, active_seconds, started_at, ended_at";

export function createTransport(deviceId: string): Transport {
  return {
    start: (cmd) =>
      rpc<ServerSession>("start_workout", {
        client_session_id: cmd.clientSessionId,
        activity: cmd.activity,
        client_started_at: new Date(cmd.at).toISOString(),
        device_id: deviceId,
      }),
    transition: (session, cmd) =>
      rpc<ServerSession>(`${cmd.kind}_workout`, {
        session_id: session.id,
        expected_version: session.version,
        client_event_id: cmd.id,
        client_at: new Date(cmd.at).toISOString(),
        device_id: deviceId,
      }),
    logSet: async (session, cmd) =>
      (
        await rpc<{ id: string }>("log_strength_set", {
          session_id: session.id,
          client_set_id: cmd.id,
          exercise: cmd.exercise,
          reps: cmd.reps,
          weight_kg: cmd.weightKg,
          client_at: new Date(cmd.at).toISOString(),
        })
      ).id,
    deleteSet: async (session, setServerId) => {
      await rpc("delete_strength_set", { session_id: session.id, set_id: setServerId });
    },
    fetchSession: async (id) => {
      const { data, error } = await supabase.from("workout_sessions").select(SESSION_COLUMNS).eq("id", id).maybeSingle();
      if (error) throw classify(error);
      return data;
    },
  };
}

/** The athlete's open workout with its events and sets, for recovery when nothing is saved locally. */
export async function fetchOpenWorkout() {
  const { data, error } = await supabase.rpc("get_open_workout");
  if (error) throw classify(error);
  const session = data?.[0];
  if (!session) return null;
  const [events, sets] = await Promise.all([
    supabase.from("workout_session_events").select("client_event_id, kind, effective_at").eq("session_id", session.id).order("effective_at").order("id"),
    supabase.from("strength_sets").select("id, client_set_id, exercise, reps, weight_kg, effective_at, deleted_at").eq("session_id", session.id).order("effective_at"),
  ]);
  if (events.error) throw classify(events.error);
  if (sets.error) throw classify(sets.error);
  return { session, events: events.data, sets: sets.data };
}

/** Uploads of GPS fixes and steps (see tracking/upload.ts). */
export const trackingApi: TrackingApi = {
  sendPoints: async (serverSessionId, points) => {
    await rpc("add_route_points", { session_id: serverSessionId, points });
  },
  sendSteps: async (serverSessionId, samples) => {
    await rpc("add_motion_samples", { session_id: serverSessionId, samples });
  },
};

/** The server-computed measurements for a workout (distance, steps, coverage), each with its source. */
export async function fetchWorkoutMetrics(serverSessionId: string): Promise<WorkoutMetric[]> {
  const { data, error } = await supabase
    .from("workout_metrics")
    .select("metric, value, source, provenance")
    .eq("session_id", serverSessionId);
  if (error) throw classify(error);
  return data.flatMap((row) => {
    const parsed = workoutMetricSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Attach a health-platform workout summary as evidence (see evidence/attach.ts). */
export async function attachEvidence(serverSessionId: string, evidence: PlatformEvidence): Promise<void> {
  await rpc("attach_workout_evidence", { session_id: serverSessionId, evidence });
}

export async function fetchEvidence(serverSessionId: string): Promise<AttachedEvidence[]> {
  const { data, error } = await supabase
    .from("workout_evidence")
    .select("provider, source_name, device_name, overlap, hr_avg")
    .eq("session_id", serverSessionId);
  if (error) throw classify(error);
  return data.flatMap((row) => {
    const parsed = attachedEvidenceSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Workouts finished in the last 24 hours that have no Apple Health evidence yet (watches can sync late). */
export async function fetchWorkoutsAwaitingEvidence(): Promise<{ id: string; start: number; end: number }[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("id, started_at, ended_at, workout_evidence(provider)")
    .in("state", ["submitted", "accepted", "needs_review", "rejected"])
    .gt("ended_at", since)
    .order("ended_at", { ascending: false })
    .limit(10);
  if (error) throw classify(error);
  return data
    .filter((s) => s.ended_at !== null && !s.workout_evidence.some((e) => e.provider === "healthkit"))
    .map((s) => ({ id: s.id, start: Date.parse(s.started_at), end: Date.parse(s.ended_at!) }));
}

/** The server's scoring outcome for a workout; null while scoring is switched off or not done yet. */
export async function fetchWorkoutScore(serverSessionId: string): Promise<WorkoutScore | null> {
  const { data, error } = await supabase
    .from("workout_scores")
    .select("status, categories, base, verification, performance, factor, total, detail")
    .eq("session_id", serverSessionId)
    .maybeSingle();
  if (error) throw classify(error);
  const parsed = workoutScoreSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

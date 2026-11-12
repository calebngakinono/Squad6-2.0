import { supabase } from "@/lib/supabase";
import { TransportError, type ServerSession, type Transport } from "./queue";

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

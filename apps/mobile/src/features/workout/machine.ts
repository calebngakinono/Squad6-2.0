// Local mirror of the server's workout state machine (supabase/migrations/*_workout_sessions.sql).
// Used for the live screen while requests may still be queued offline. The server stays the authority:
// its times and active_seconds replace these once synced.

export const ACTIVITIES = [
  { value: "run", label: "Run", gps: true, sets: false },
  { value: "walk", label: "Walk", gps: true, sets: false },
  { value: "hike", label: "Hike", gps: true, sets: false },
  { value: "cycle", label: "Ride", gps: true, sets: false },
  { value: "swim", label: "Swim", gps: false, sets: false },
  { value: "strength", label: "Strength", gps: false, sets: true },
  { value: "hiit", label: "HIIT", gps: false, sets: false },
  { value: "yoga", label: "Yoga", gps: false, sets: false },
  { value: "indoor_cardio", label: "Indoor cardio", gps: false, sets: false },
  { value: "other", label: "Other", gps: false, sets: false },
] as const;

export type Activity = (typeof ACTIVITIES)[number]["value"];
export const activityInfo = (a: Activity) => ACTIVITIES.find((x) => x.value === a)!;

export type EventKind = "start" | "pause" | "resume" | "finish" | "cancel";
export type LocalEvent = { id: string; kind: EventKind; at: number }; // at: ms since epoch (client clock)
export type LocalState = "active" | "paused" | "finished" | "cancelled";

const NEXT: Record<LocalState, Partial<Record<EventKind, LocalState>>> = {
  active: { pause: "paused", finish: "finished", cancel: "cancelled" },
  paused: { resume: "active", finish: "finished", cancel: "cancelled" },
  finished: {},
  cancelled: {},
};

export function stateOf(events: readonly LocalEvent[]): LocalState {
  let state: LocalState = "active";
  for (const e of events.slice(1)) state = NEXT[state][e.kind] ?? state;
  return state;
}

export const canApply = (events: readonly LocalEvent[], kind: Exclude<EventKind, "start">) =>
  NEXT[stateOf(events)][kind] !== undefined;

/** Time for a new event: never earlier than the previous one, even if the phone clock jumps back. */
export function nextEventTime(events: readonly LocalEvent[], now: number): number {
  const last = events[events.length - 1]?.at ?? now;
  return Math.max(now, last);
}

/** Active seconds: start/resume → pause/finish/cancel; an open run counts up to `now`. Same rule as the server. */
export function activeSeconds(events: readonly LocalEvent[], now: number): number {
  let total = 0;
  let runningSince: number | null = null;
  for (const e of events) {
    if (e.kind === "start" || e.kind === "resume") runningSince ??= e.at;
    else if (runningSince !== null) {
      total += e.at - runningSince;
      runningSince = null;
    }
  }
  if (runningSince !== null) total += Math.max(0, now - runningSince);
  return Math.max(0, Math.floor(total / 1000));
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

import { useEffect, useState, useSyncExternalStore } from "react";
import { workoutStore } from "./store";

export const useWorkout = () => useSyncExternalStore(workoutStore.subscribe, workoutStore.getSnapshot);

/** Re-renders every second while `running`, for the live timer. */
export function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const first = setTimeout(() => setNow(Date.now()), 0); // catch up immediately after resuming
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [running]);
  // When not running, the live time doesn't depend on "now" (no open interval), so the last value is fine.
  return now;
}

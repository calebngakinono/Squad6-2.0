import { workoutOutcome, type Outcome, type WorkoutScore } from "@squad-six/shared";
import { useCallback, useEffect, useState } from "react";
import { fetchScoringStart, fetchWorkoutScore, rescoreWorkout } from "./transport";

type Session = { id: string; state: string; started_at: string; ended_at: string | null };

/**
 * The outcome of one workout that has reached the server, kept fresh: while it is being scored it is
 * read again every few seconds, and Try again asks the server to score it. `score` is what the caller
 * already holds (the workout screen's store), used until a fresh one is read.
 */
export function useOutcome(session: Session | null, known: WorkoutScore | null = null) {
  // The score as last read here; until then (or if a read fails) the caller's.
  const [fresh, setFresh] = useState<WorkoutScore | null>(null);
  const score = fresh ?? known;
  const [scoringFrom, setScoringFrom] = useState<string | null | undefined>(undefined);
  const [now, setNow] = useState(() => new Date());
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const id = session?.id ?? null;
  useEffect(() => {
    fetchScoringStart().then(setScoringFrom, () => setScoringFrom(undefined));
  }, []);

  const refresh = useCallback(async () => {
    if (!id) return;
    const read = await fetchWorkoutScore(id).catch(() => undefined);
    if (read !== undefined) setFresh(read);
    setNow(new Date());
  }, [id]);

  // First read when the workout reaches the server.
  useEffect(() => {
    if (!id) return;
    let live = true;
    fetchWorkoutScore(id).then(
      (read) => {
        if (!live) return;
        setFresh(read);
        setNow(new Date());
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [id]);

  const outcome: Outcome | null =
    session && scoringFrom !== undefined
      ? workoutOutcome({ state: session.state, startedAt: session.started_at, endedAt: session.ended_at, score, scoringFrom, now })
      : null;

  // While the score is on its way, look again every few seconds (and once more at the grace limit).
  const waiting = outcome?.kind === "scoring";
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [waiting, refresh]);

  const retry = useCallback(async () => {
    if (!id) return;
    setRetrying(true);
    setRetryFailed(false);
    try {
      await rescoreWorkout(id);
      await refresh();
    } catch {
      setRetryFailed(true);
    } finally {
      setRetrying(false);
    }
  }, [id, refresh]);

  return { outcome, score, retry, retrying, retryFailed };
}

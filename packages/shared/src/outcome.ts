// What happened to one workout, in a word the app can explain. The server decides the points
// (workout_scores, written by the scorer); this only reads them, so it never calculates an award.
// Every finished workout lands in exactly one outcome, so nothing waits on "Scoring…" forever.

export const EVIDENCE_WINDOW_HOURS = 24;
/** How long a finished workout may go without a score before the app offers Try again. */
export const SCORING_GRACE_SECONDS = 60;

export type OutcomeKind =
  | "in_progress" // still recording or paused
  | "counted" // scored and accepted: earns points
  | "unverified" // nothing but the timer: saved, counts for the week, 0 competitive points
  | "not_counted" // too short, or third workout of the day
  | "in_review" // failed a plausibility check: 0 until a person reviews it
  | "merged" // counted inside the workout just before it
  | "not_scored" // started before points were being awarded in this environment
  | "scoring" // finished moments ago; the score is on its way
  | "stuck" // finished a while ago and still has no score: offer Try again
  | "rejected" // reviewed and not accepted
  | "expired" // left open too long and closed by the server
  | "discarded";

export type OutcomeInput = {
  state: string;
  startedAt: string;
  endedAt: string | null;
  score: {
    status: string;
    total: number;
    categories: string[];
    verification?: number;
    detail?: { reason?: string } | null;
  } | null;
  /** The earliest time any scoring rule was switched on here; null when it never was. */
  scoringFrom: string | null;
  now: Date;
};

export type Outcome = {
  kind: OutcomeKind;
  /** Points the server awarded (0 unless counted). */
  points: number;
  /** The server's own reason, when it gave one. */
  reason: string | null;
  /** Until when Apple Health evidence can still change this workout; null when it can't. */
  evidenceOpenUntil: Date | null;
  /** Counts toward the personal weekly goal and consistency (any finished, kept workout). */
  personal: boolean;
};

const FINISHED = ["submitted", "accepted", "needs_review"];
const MAX_VERIFICATION = 30;

export function workoutOutcome(i: OutcomeInput): Outcome {
  const base = { points: 0, reason: i.score?.detail?.reason ?? null, evidenceOpenUntil: null, personal: false };
  if (i.state === "active" || i.state === "paused") return { ...base, kind: "in_progress" };
  if (i.state === "cancelled") return { ...base, kind: "discarded" };
  if (i.state === "expired") return { ...base, kind: "expired" };
  if (i.state === "rejected") return { ...base, kind: "rejected" };
  if (!FINISHED.includes(i.state)) return { ...base, kind: "stuck" };

  const ended = i.endedAt ? new Date(i.endedAt) : null;
  const windowEnd = ended ? new Date(ended.getTime() + EVIDENCE_WINDOW_HOURS * 3600_000) : null;
  const windowOpen = !!windowEnd && windowEnd > i.now;
  const personal = true;

  const s = i.score;
  if (!s) {
    const scoringOn = i.scoringFrom !== null && new Date(i.scoringFrom) <= new Date(i.startedAt);
    if (!scoringOn) return { ...base, kind: "not_scored", personal };
    const fresh = !!ended && (i.now.getTime() - ended.getTime()) / 1000 < SCORING_GRACE_SECONDS;
    return { ...base, kind: fresh ? "scoring" : "stuck", personal };
  }

  switch (s.status) {
    case "accepted": {
      const canImprove = (s.verification ?? MAX_VERIFICATION) < MAX_VERIFICATION;
      return { ...base, kind: "counted", points: s.total, evidenceOpenUntil: windowOpen && canImprove ? windowEnd : null, personal };
    }
    case "needs_review":
      return { ...base, kind: "in_review", personal };
    case "merged":
      return { ...base, kind: "merged", personal };
    case "recorded": {
      // The scorer checks the minimum time before evidence, so its reason tells the two apart.
      const tooShort = /minimum/i.test(s.detail?.reason ?? "");
      if (!tooShort && s.categories.length === 0) {
        return { ...base, kind: "unverified", evidenceOpenUntil: windowOpen ? windowEnd : null, personal };
      }
      return { ...base, kind: "not_counted", personal };
    }
    default:
      return { ...base, kind: "stuck", personal };
  }
}

/** The earliest switch-on time among the scoring rule versions (null when none is on). */
export function scoringStart(versions: { active_from: string | null }[]): string | null {
  const times = versions.map((v) => v.active_from).filter((t): t is string => !!t).sort();
  return times[0] ?? null;
}

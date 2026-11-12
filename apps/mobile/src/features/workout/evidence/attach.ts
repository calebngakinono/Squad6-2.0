import { platformEvidenceSchema, type PlatformEvidence } from "@squad-six/shared";
import { TransportError } from "../queue";
import { pickEvidence, summarizeHeartRate, toEvidence, type HeartRateSample, type PlatformWorkout, type Span } from "./match";

// After a workout: look for a matching health-platform workout and attach its summary. Pure: the
// platform (Apple Health) and the network are injected, so the whole flow is unit-tested.

/** One health platform. Apple Health today; Health Connect implements the same three calls later. */
export interface EvidenceProvider {
  findWorkouts(span: Span): Promise<PlatformWorkout[]>;
  heartRate(span: Span): Promise<HeartRateSample[]>;
}

export type EvidenceOutcome =
  /** Attached (now or earlier). */
  | { status: "attached" }
  /** Nothing usable in the health platform (yet): worth checking again later. */
  | { status: "none" }
  /** The server will never take evidence for this workout (window closed, record used elsewhere). */
  | { status: "closed"; code: string }
  /** Couldn't read the platform or reach the server: try again later. */
  | { status: "retry" };

export async function matchAndAttach(
  session: Span,
  provider: EvidenceProvider,
  attach: (evidence: PlatformEvidence) => Promise<void>,
): Promise<EvidenceOutcome> {
  let evidence: PlatformEvidence;
  try {
    const best = pickEvidence(session, await provider.findWorkouts(session));
    if (!best) return { status: "none" };
    const shared = { start: Math.max(session.start, best.start), end: Math.min(session.end, best.end) };
    // Heart rate is optional: a workout without it is still a platform record.
    const samples = await provider.heartRate(shared).catch(() => []);
    evidence = toEvidence(best, summarizeHeartRate(samples, shared));
  } catch {
    return { status: "retry" };
  }
  if (!platformEvidenceSchema.safeParse(evidence).success) return { status: "none" };

  try {
    await attach(evidence);
    return { status: "attached" };
  } catch (e) {
    if (!(e instanceof TransportError) || e.kind !== "rejected") return { status: "retry" };
    // Already attached counts as done; another record may still turn up after a refusal of this one.
    if (e.code === "evidence_already_attached") return { status: "attached" };
    if (["evidence_already_used", "manual_record", "own_record", "no_overlap", "invalid_evidence"].includes(e.code)) return { status: "none" };
    return { status: "closed", code: e.code };
  }
}

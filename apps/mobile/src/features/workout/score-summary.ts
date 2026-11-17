import type { WorkoutScore } from "@squad-six/shared";

// Turns the server's scoring outcome into the lines the summary shows. Display only: every number
// comes from the server. Pure, so it is unit-tested.

const CATEGORY_LABELS: Record<string, string> = {
  location: "GPS",
  motion: "steps",
  heart_rate: "heart rate",
  platform_record: "a health-app workout",
  live_set_log: "your live set log",
};

export type ScoreSummary = {
  headline: string;
  /** Points lines, only for a workout that earned points. */
  lines: { label: string; value: string }[];
  /** Plain-language explanations: why it earned nothing, or which evidence didn't count. */
  notes: string[];
};

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function summarizeScore(score: WorkoutScore): ScoreSummary {
  const notes = [...(score.detail.notes ?? [])];
  const reason = score.detail.reason;

  if (score.status !== "accepted") {
    const headline =
      score.status === "needs_review"
        ? "In review: no points for now"
        : score.status === "merged"
          ? "Counted with your previous workout"
          : score.status === "rejected"
            ? "Not counted: 0 points"
            : "Saved: 0 points";
    return { headline, lines: [], notes: reason ? [reason, ...notes] : notes };
  }

  const evidence = score.categories.map((c) => CATEGORY_LABELS[c] ?? c);
  const lines = [
    { label: "Showing up", value: `${score.base}` },
    { label: `Verified by ${list(evidence)}`, value: `+${score.verification}` },
    { label: "Performance", value: `+${score.performance}` },
  ];
  if (score.factor < 1) {
    lines.push({ label: "Second workout of the day", value: `× ${score.factor}` });
  }
  if ((score.detail.merged_workouts ?? 1) > 1) {
    notes.unshift(`Scored together with ${score.detail.merged_workouts! - 1} workout${score.detail.merged_workouts === 2 ? "" : "s"} right after it.`);
  }
  return { headline: `${score.total} points`, lines, notes };
}

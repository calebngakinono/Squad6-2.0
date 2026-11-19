import { seasonWeeksLeft, workoutGap, type Answers, type OnboardingStep } from "@squad-six/shared";

// Pure helpers for the onboarding screens (kept free of React Native so they can be unit-tested).

export type SavedProgress = { flowVersion: number; stepId: string; answers: Answers };

/** Progress saved on the phone, or null when it is missing, unreadable, or from another flow version. */
export function parseSavedProgress(raw: string | null, flowVersion: number): SavedProgress | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SavedProgress>;
    if (v.flowVersion !== flowVersion || typeof v.stepId !== "string") return null;
    if (!v.answers || typeof v.answers !== "object" || Array.isArray(v.answers)) return null;
    return { flowVersion, stepId: v.stepId, answers: v.answers };
  } catch {
    return null;
  }
}

/** Replaces {name}-style placeholders. Unknown placeholders are left out rather than shown raw. */
export function fill(template: string, values: Record<string, string | number | null | undefined>): string {
  return template
    .replace(/\{([a-z_]+)\}/g, (_, key: string) => {
      const v = values[key];
      return v === null || v === undefined ? "" : String(v);
    })
    .replace(/ {2,}/g, " ")
    .replace(/ ([,.!?])/g, "$1")
    .trim();
}

type InfoStep = Extract<OnboardingStep, { type: "info" }>;

/** The gap screen's title, big number and text, from the person's own answers. */
export function gapView(step: InfoStep, answers: Answers) {
  const gap = workoutGap(answers, step.params);
  if (!gap || gap.yearly === 0) {
    return {
      title: step.copy.none_title ?? step.title,
      number: null,
      unit: null,
      body: step.copy.none_body ?? "",
    };
  }
  return {
    title: step.title,
    number: gap.yearly,
    unit: step.copy.unit ?? "",
    body: fill(step.body ?? "", { current: gap.current, goal: gap.goal }),
  };
}

export type PlanRow = { label: string; value: string };

/** The plan screen: one row per thing the person chose. `cityName` is looked up by the screen. */
export function planView(step: InfoStep, answers: Answers, cityName: string | null, today: Date) {
  const p = step.params;
  const name = typeof answers[p.name] === "string" ? String(answers[p.name]).trim() : "";
  const goal = answers[p.goal];
  const squad = answers[p.squad];
  const rows: PlanRow[] = [];
  if (typeof goal === "number") rows.push({ label: "Weekly goal", value: fill(step.copy.goal ?? "{goal} a week", { goal }) });
  if (typeof squad === "string" && step.copy[`squad_${squad}`]) rows.push({ label: "Squad", value: step.copy[`squad_${squad}`] });
  if (cityName) rows.push({ label: "Competing in", value: cityName });
  if (step.copy.season) {
    rows.push({ label: "Season", value: fill(step.copy.season, { weeks: seasonWeeksLeft(today), year: today.getFullYear() }) });
  }
  return { title: fill(step.title, { name }).replace(/,$/, ""), rows };
}

/** Where to go once onboarding is finished, from the "who are you training with" answer. */
export function routeAfterOnboarding(answers: Answers): "/join" | "/create-squad" | null {
  if (answers.squad === "code") return "/join";
  if (answers.squad === "start") return "/create-squad";
  return null;
}

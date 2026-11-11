import { z } from "zod";

// Onboarding flows are configuration stored in the database (table onboarding_flows), so questions,
// copy and branches can change without an app release. The app renders each step type generically.
// Final visuals come from the designer; this file only defines structure and rules.

/** Profile fields an answer may fill. The server applies these on completion and validates them again. */
export const PROFILE_FIELDS = ["display_name", "city", "home_timezone", "weekly_commitment"] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

const id = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "lowercase id");

const condition = z.object({
  step: id,
  equals: z.union([z.string(), z.number()]).optional(),
  includes: z.string().optional(), // for multi-choice answers
});

const branch = z.object({ when: condition, goto: id });

const option = z.object({ value: z.string().min(1).max(40), label: z.string().min(1).max(80) });

const base = {
  id,
  title: z.string().min(1).max(120),
  body: z.string().max(500).optional(),
  /** Where the answer is stored. Profile fields are applied to the profile; anything else stays in answers. */
  field: z.enum(PROFILE_FIELDS).optional(),
  required: z.boolean().default(true),
  /** First matching branch wins; otherwise `next`, otherwise the following step in the list. */
  branches: z.array(branch).default([]),
  next: id.optional(),
};

export const onboardingStepSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("info"), required: z.literal(false).default(false) }),
  z.object({ ...base, type: z.literal("text"), maxLength: z.number().int().min(1).max(280).default(80) }),
  z.object({
    ...base,
    type: z.literal("number"),
    min: z.number().int(),
    max: z.number().int(),
    presets: z.array(z.number().int()).default([]),
  }),
  z.object({ ...base, type: z.literal("single_choice"), options: z.array(option).min(2).max(12) }),
  z.object({
    ...base,
    type: z.literal("multi_choice"),
    options: z.array(option).min(2).max(12),
    maxSelections: z.number().int().min(1).optional(),
  }),
  z.object({ ...base, type: z.literal("timezone") }),
]);

export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

export const onboardingFlowSchema = z
  .object({
    version: z.number().int().positive(),
    steps: z.array(onboardingStepSchema).min(1).max(40),
  })
  .superRefine((flow, ctx) => {
    const ids = new Set<string>();
    for (const s of flow.steps) {
      if (ids.has(s.id)) ctx.addIssue({ code: "custom", message: `duplicate step id ${s.id}` });
      ids.add(s.id);
    }
    for (const s of flow.steps) {
      for (const target of [s.next, ...s.branches.map((b) => b.goto), ...s.branches.map((b) => b.when.step)]) {
        if (target && !ids.has(target)) ctx.addIssue({ code: "custom", message: `${s.id} points to unknown step ${target}` });
      }
    }
    const fields = flow.steps.flatMap((s) => (s.field ? [s.field] : []));
    if (new Set(fields).size !== fields.length) ctx.addIssue({ code: "custom", message: "a profile field is used twice" });
  });

export type OnboardingFlow = z.infer<typeof onboardingFlowSchema>;
export type AnswerValue = string | number | string[];
export type Answers = Record<string, AnswerValue>;

/** Validates one answer against its step. Returns an error message or null. */
export function validateAnswer(step: OnboardingStep, value: AnswerValue | undefined): string | null {
  const empty = value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  if (step.type === "info") return null;
  if (empty) return step.required ? "Please answer to continue." : null;

  switch (step.type) {
    case "text": {
      if (typeof value !== "string") return "Enter some text.";
      const t = value.trim();
      if (t.length === 0) return step.required ? "Please answer to continue." : null;
      return t.length > step.maxLength ? `Keep it under ${step.maxLength} characters.` : null;
    }
    case "number":
      if (typeof value !== "number" || !Number.isInteger(value)) return "Enter a whole number.";
      return value < step.min || value > step.max ? `Choose between ${step.min} and ${step.max}.` : null;
    case "single_choice":
      return typeof value === "string" && step.options.some((o) => o.value === value) ? null : "Choose one option.";
    case "multi_choice": {
      if (!Array.isArray(value) || !value.every((v) => step.options.some((o) => o.value === v))) return "Choose from the list.";
      if (new Set(value).size !== value.length) return "Choose each option once.";
      return step.maxSelections && value.length > step.maxSelections ? `Choose up to ${step.maxSelections}.` : null;
    }
    case "timezone":
      return typeof value === "string" && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(value) ? null : "Choose a time zone.";
  }
}

function matches(when: z.infer<typeof condition>, answers: Answers): boolean {
  const a = answers[when.step];
  if (when.equals !== undefined) return a === when.equals;
  if (when.includes !== undefined) return Array.isArray(a) && a.includes(when.includes);
  return a !== undefined;
}

/** The step after `currentId` given the answers so far, or null when the flow is finished. */
export function nextStepId(flow: OnboardingFlow, currentId: string, answers: Answers): string | null {
  const index = flow.steps.findIndex((s) => s.id === currentId);
  if (index === -1) return flow.steps[0]?.id ?? null;
  const step = flow.steps[index];
  const hit = step.branches.find((b) => matches(b.when, answers));
  if (hit) return hit.goto;
  if (step.next) return step.next;
  return flow.steps[index + 1]?.id ?? null;
}

/** The ordered steps the athlete visits for these answers (used for progress and to drop stale answers). */
export function pathFor(flow: OnboardingFlow, answers: Answers): string[] {
  const path: string[] = [];
  let current: string | null = flow.steps[0]?.id ?? null;
  while (current && !path.includes(current)) {
    path.push(current);
    current = nextStepId(flow, current, answers);
  }
  return path;
}

/** Answers for steps on the current path only (a changed branch must not keep answers from the old one). */
export function answersOnPath(flow: OnboardingFlow, answers: Answers): Answers {
  const onPath = new Set(pathFor(flow, answers));
  return Object.fromEntries(Object.entries(answers).filter(([k]) => onPath.has(k)));
}

/** The first step on the path whose answer is missing or invalid, or null when the flow can be completed. */
export function firstIncompleteStepId(flow: OnboardingFlow, answers: Answers): string | null {
  for (const stepId of pathFor(flow, answers)) {
    const step = flow.steps.find((s) => s.id === stepId)!;
    if (validateAnswer(step, answers[stepId]) !== null) return stepId;
  }
  return null;
}

/** Profile values to apply on completion, taken from steps on the path that declare a `field`. */
export function profileUpdates(flow: OnboardingFlow, answers: Answers): Partial<Record<ProfileField, AnswerValue>> {
  const onPath = answersOnPath(flow, answers);
  const out: Partial<Record<ProfileField, AnswerValue>> = {};
  for (const step of flow.steps) {
    if (step.field && onPath[step.id] !== undefined) {
      const v = onPath[step.id];
      out[step.field] = typeof v === "string" ? v.trim() : v;
    }
  }
  return out;
}

import { onboardingFlowSchema, profileUpdates, answersOnPath, type Answers, type OnboardingFlow } from "@squad-six/shared";
import { supabase } from "@/lib/supabase";

export type OnboardingState = { flow: OnboardingFlow; step: string | null; answers: Answers };

export async function loadOnboarding(userId: string): Promise<OnboardingState> {
  const [flowRes, progressRes] = await Promise.all([
    supabase.from("onboarding_flows").select("definition").eq("active", true).single(),
    supabase.from("profile_private").select("onboarding_flow_version, onboarding_step, onboarding_answers").eq("user_id", userId).single(),
  ]);
  if (flowRes.error) throw flowRes.error;
  if (progressRes.error) throw progressRes.error;

  // Config comes from the server, so validate it like any external input.
  const flow = onboardingFlowSchema.parse(flowRes.data.definition);
  const saved = progressRes.data;
  const sameFlow = saved.onboarding_flow_version === flow.version;
  const answers = sameFlow && saved.onboarding_answers && typeof saved.onboarding_answers === "object" && !Array.isArray(saved.onboarding_answers)
    ? (saved.onboarding_answers as Answers)
    : {};
  return { flow, step: sameFlow ? saved.onboarding_step : null, answers };
}

export async function saveProgress(flow: OnboardingFlow, step: string, answers: Answers) {
  const { error } = await supabase.rpc("save_onboarding_progress", {
    flow_version: flow.version,
    current_step: step,
    answers: answersOnPath(flow, answers),
  });
  if (error) throw error;
}

export async function completeOnboarding(flow: OnboardingFlow, answers: Answers) {
  const kept = answersOnPath(flow, answers);
  const p = profileUpdates(flow, kept);
  const { error } = await supabase.rpc("complete_onboarding", {
    flow_version: flow.version,
    answers: kept,
    display_name: String(p.display_name ?? ""),
    // Optional in the database function; generated types don't mark SQL arguments as nullable.
    city: (typeof p.city === "string" ? p.city : null) as unknown as string,
    home_timezone: String(p.home_timezone ?? ""),
    weekly_commitment: (typeof p.weekly_commitment === "number" ? p.weekly_commitment : null) as unknown as number,
  });
  if (error) throw error;
}

const MESSAGES: Record<string, string> = {
  invalid_display_name: "Add a name your squad will see.",
  invalid_city: "Check the city name.",
  invalid_weekly_commitment: "Choose between 1 and 14 days.",
  timezone_required: "Confirm your time zone.",
  "home timezone can change once every 7 days": "Your time zone was changed recently. You can change it again in a week.",
};

export function onboardingErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? "";
  if (msg.startsWith("unknown timezone")) return "That time zone isn't recognised. Try a name like America/Denver.";
  return MESSAGES[msg] ?? "Couldn't save. Check your connection and try again.";
}

/** The phone's current IANA time zone, if the platform reports one. */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

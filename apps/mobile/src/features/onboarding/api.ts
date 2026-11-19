import { onboardingFlowSchema, profileUpdates, answersOnPath, type Answers, type OnboardingFlow } from "@squad-six/shared";
import { supabase } from "@/lib/supabase";

/**
 * The active onboarding flow. Readable before sign-up: onboarding runs first and the account is
 * created near the end, so this works signed in or not.
 */
export async function loadFlow(): Promise<OnboardingFlow> {
  const { data, error } = await supabase.from("onboarding_flows").select("definition").eq("active", true).single();
  if (error) throw error;
  // Config comes from the server, so validate it like any external input.
  return onboardingFlowSchema.parse(data.definition);
}

/**
 * Saves the answers to the signed-in account and marks onboarding complete. The flow no longer asks
 * for a time zone, so the phone's is used unless the flow has its own time zone step; it can be
 * changed later in Settings.
 */
export async function completeOnboarding(flow: OnboardingFlow, answers: Answers, timeZone = deviceTimeZone() ?? "UTC") {
  const kept = answersOnPath(flow, answers);
  const p = profileUpdates(flow, kept);
  const { error } = await supabase.rpc("complete_onboarding", {
    flow_version: flow.version,
    answers: kept,
    display_name: String(p.display_name ?? ""),
    // Optional in the database function; generated types don't mark SQL arguments as nullable.
    city_id: (typeof p.city === "number" ? p.city : null) as unknown as number,
    home_timezone: typeof p.home_timezone === "string" ? p.home_timezone : timeZone,
    weekly_commitment: (typeof p.weekly_commitment === "number" ? p.weekly_commitment : null) as unknown as number,
  });
  if (error) throw error;
}

const MESSAGES: Record<string, string> = {
  invalid_display_name: "Add a name your squad will see.",
  invalid_city: "Choose your city from the list.",
  invalid_weekly_commitment: "Choose between 1 and 7 days.",
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

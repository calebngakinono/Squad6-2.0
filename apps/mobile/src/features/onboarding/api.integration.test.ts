import type { Database } from "@squad-six/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Onboarding against a LOCAL Supabase only (see squads/api.integration.test.ts for how to run).
const url = process.env.SQUADS_IT_URL;
const key = process.env.SQUADS_IT_KEY;
const isLocal = !!url && /^http:\/\/(127\.0\.0\.1|localhost)/.test(url);

const current: { client: SupabaseClient<Database> | null } = { client: null };
vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return current.client;
  },
}));

describe.skipIf(!isLocal)("onboarding API against local Supabase", () => {
  let api: typeof import("./api");
  beforeAll(async () => {
    api = await import("./api");
  });

  it("loads the active flow, saves progress, resumes, and completes", async () => {
    const client = createClient<Database>(url!, key!, { auth: { persistSession: false } });
    const { data } = await client.auth.signUp({ email: `onb-${Date.now()}@example.com`, password: "test-password-123" });
    const userId = data.user!.id;
    current.client = client;

    const first = await api.loadOnboarding(userId);
    expect(first.flow.version).toBe(1);
    expect(first.step).toBeNull();

    const answers = { display_name: "Ana", experience: "new", goal: "strength" };
    await api.saveProgress(first.flow, "beginner_tips", answers);
    const resumed = await api.loadOnboarding(userId);
    expect(resumed.step).toBe("beginner_tips");
    expect(resumed.answers).toMatchObject(answers);

    await api.completeOnboarding(first.flow, {
      ...answers,
      weekly_commitment: 3,
      city: " Denver ",
      home_timezone: "America/Denver",
    });
    const profile = await client.from("profiles").select("display_name, city").eq("id", userId).single();
    const priv = await client
      .from("profile_private")
      .select("home_timezone, weekly_commitment, onboarding_completed_at, onboarding_answers")
      .eq("user_id", userId)
      .single();
    expect(profile.data).toEqual({ display_name: "Ana", city: "Denver" });
    expect(priv.data).toMatchObject({ home_timezone: "America/Denver", weekly_commitment: 3 });
    expect(priv.data!.onboarding_completed_at).not.toBeNull();
    expect(priv.data!.onboarding_answers).toMatchObject({ goal: "strength", experience: "new" });
  });

  it("maps a bad time zone to a friendly message", async () => {
    const client = createClient<Database>(url!, key!, { auth: { persistSession: false } });
    await client.auth.signUp({ email: `onb2-${Date.now()}@example.com`, password: "test-password-123" });
    current.client = client;
    const { flow } = await api.loadOnboarding((await client.auth.getUser()).data.user!.id);
    const err = await api
      .completeOnboarding(flow, { display_name: "B", weekly_commitment: 2, city: "Denver", home_timezone: "Mars/Base" })
      .catch((e) => e);
    expect(api.onboardingErrorMessage(err)).toMatch(/isn't recognised/);
  });
});

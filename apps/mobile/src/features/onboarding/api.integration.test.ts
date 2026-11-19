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

  it("loads the active flow before sign-up, then completes it after sign-up", async () => {
    // A visitor (not signed in) can read the flow: onboarding runs before the account exists.
    current.client = createClient<Database>(url!, key!, { auth: { persistSession: false } });
    const flow = await api.loadFlow();
    expect(flow.version).toBe(3);

    const client = createClient<Database>(url!, key!, { auth: { persistSession: false } });
    const { data } = await client.auth.signUp({ email: `onb-${Date.now()}@example.com`, password: "test-password-123" });
    const userId = data.user!.id;
    current.client = client;

    await api.completeOnboarding(
      flow,
      {
        reason: "routine",
        days_now: 1,
        weekly_commitment: 3,
        obstacles: ["busy"],
        tried: ["apps"],
        squad: "none",
        display_name: "Ana",
        city: 5419384,
        stale_answer: "dropped",
      },
      "America/Denver",
    );
    const profile = await client.from("profiles").select("display_name, city").eq("id", userId).single();
    const priv = await client
      .from("profile_private")
      .select("home_timezone, weekly_commitment, onboarding_completed_at, onboarding_answers")
      .eq("user_id", userId)
      .single();
    expect(profile.data).toEqual({ display_name: "Ana", city: "Denver, Colorado" });
    expect(priv.data).toMatchObject({ home_timezone: "America/Denver", weekly_commitment: 3 });
    expect(priv.data!.onboarding_completed_at).not.toBeNull();
    expect(priv.data!.onboarding_answers).toMatchObject({ reason: "routine", days_now: 1 });
    expect(priv.data!.onboarding_answers).not.toHaveProperty("stale_answer");
  });

  it("maps a bad time zone to a friendly message", async () => {
    const client = createClient<Database>(url!, key!, { auth: { persistSession: false } });
    await client.auth.signUp({ email: `onb2-${Date.now()}@example.com`, password: "test-password-123" });
    current.client = client;
    const flow = await api.loadFlow();
    const err = await api
      .completeOnboarding(flow, { display_name: "B", weekly_commitment: 2, city: 5419384 }, "Mars/Base")
      .catch((e) => e);
    expect(api.onboardingErrorMessage(err)).toMatch(/isn't recognised/);
  });
});

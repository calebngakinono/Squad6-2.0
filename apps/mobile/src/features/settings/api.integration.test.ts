import type { Database } from "@squad-six/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

// Settings against a LOCAL Supabase only (see squads/api.integration.test.ts).
const url = process.env.SQUADS_IT_URL;
const key = process.env.SQUADS_IT_KEY;
const isLocal = !!url && /^http:\/\/(127\.0\.0\.1|localhost)/.test(url);

const current: { client: SupabaseClient<Database> | null } = { client: null };
vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return current.client;
  },
}));

describe.skipIf(!isLocal)("settings against local Supabase", () => {
  it("edits the profile, then deletes the account so it can no longer sign in", async () => {
    const { loadSettings, settingsApi } = await import("./api");
    const email = `settings-${Date.now()}@example.com`;
    const client = createClient<Database>(url!, key!, { auth: { persistSession: false } });
    const { data } = await client.auth.signUp({ email, password: "test-password-123" });
    const userId = data.user!.id;
    current.client = client;
    await client.rpc("complete_onboarding", {
      flow_version: 2, answers: {}, display_name: "Before", city_id: 5419384, home_timezone: "America/Denver", weekly_commitment: 3,
    });

    await settingsApi.setDisplayName(userId, "  After ");
    await settingsApi.setCity(userId, 5546220);
    await settingsApi.setWeeklyCommitment(userId, 5);
    await expect(settingsApi.setHomeTimezone("Europe/London")).rejects.toMatchObject({ message: "home timezone can change once every 7 days" });
    expect(await loadSettings(userId)).toMatchObject({
      email, displayName: "After", cityId: 5546220, city: "Saint George, Utah", homeTimezone: "America/Denver", weeklyCommitment: 5,
    });

    await settingsApi.deleteAccount();
    const again = createClient<Database>(url!, key!, { auth: { persistSession: false } });
    const signIn = await again.auth.signInWithPassword({ email, password: "test-password-123" });
    expect(signIn.error).not.toBeNull();
  });
});

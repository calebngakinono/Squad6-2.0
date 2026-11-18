import type { Database } from "@squad-six/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

// Challenges against a LOCAL Supabase only (see squads/api.integration.test.ts).
const url = process.env.SQUADS_IT_URL;
const key = process.env.SQUADS_IT_KEY;
const isLocal = !!url && /^http:\/\/(127\.0\.0\.1|localhost)/.test(url);

const current: { client: SupabaseClient<Database> | null } = { client: null };
vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return current.client;
  },
}));

describe.skipIf(!isLocal)("challenges against local Supabase", () => {
  it("lists this week's challenges, joins next week, and never lets the app write progress", async () => {
    const api = await import("./api");
    const client = createClient<Database>(url!, key!, { auth: { persistSession: false } });
    await client.auth.signUp({ email: `chal-${Date.now()}@example.com`, password: "test-password-123" });
    current.client = client;
    await client.rpc("complete_onboarding", {
      flow_version: 2, answers: {}, display_name: "Chidi", city_id: 5419384, home_timezone: "America/Denver", weekly_commitment: 3,
    });

    const before = await api.loadMyChallenges();
    expect(before.map((c) => c.challenge_id)).toEqual(["weekly-tiers-v1", "squad-week-v1"]);
    expect(before[0]).toMatchObject({ kind: "individual_tiered", joined: false, tier: null, points: 0 });
    expect(before[1]).toMatchObject({ kind: "squad_participation", join_blocked: "not_in_squad" });

    // Next week is always open for joining, whatever day the test runs.
    await api.joinChallenge("weekly-tiers-v1", "next");
    await api.joinChallenge("weekly-tiers-v1", "next");
    expect((await api.loadMyChallenges())[0]).toMatchObject({ joined_next_week: true, points: 0 });

    await expect(api.joinChallenge("squad-week-v1", "next")).rejects.toMatchObject({ message: "not_in_squad" });

    const { data: entries } = await client.from("challenge_participants").select("id, tier");
    expect(entries).toHaveLength(1);
    const { error: writeError } = await client.from("challenge_participants").update({ tier: "gold" }).eq("id", entries![0].id);
    expect(writeError).not.toBeNull();
  });
});

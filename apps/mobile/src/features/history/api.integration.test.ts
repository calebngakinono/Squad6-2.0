import type { Database } from "@squad-six/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

// History and squad activity against a LOCAL Supabase only (see squads/api.integration.test.ts).
const url = process.env.SQUADS_IT_URL;
const key = process.env.SQUADS_IT_KEY;
const isLocal = !!url && /^http:\/\/(127\.0\.0\.1|localhost)/.test(url);

const current: { client: SupabaseClient<Database> | null } = { client: null };
vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return current.client;
  },
}));

describe.skipIf(!isLocal)("history and squad activity against local Supabase", () => {
  it("lists my finished workout and shows it to my squad, without location data", async () => {
    const api = await import("./api");
    const { drain } = await import("../workout/queue");
    const { createTransport } = await import("../workout/transport");
    const client = createClient<Database>(url!, key!, { auth: { persistSession: false } });
    await client.auth.signUp({ email: `hist-${Date.now()}@example.com`, password: "test-password-123" });
    current.client = client;
    await client.rpc("complete_onboarding", {
      flow_version: 2, answers: {}, display_name: "Hana", city_id: 5419384, home_timezone: "America/Denver", weekly_commitment: 3,
    });
    expect(await api.loadSquadActivity()).toEqual([]);
    await client.rpc("create_squad", { squad_name: "History Squad", squad_city_id: 5419384, squad_description: "" });

    const cid = crypto.randomUUID();
    const now = Date.now();
    await drain(
      [
        { type: "start", id: cid, clientSessionId: cid, activity: "walk", at: now - 30 * 60_000 },
        { type: "transition", id: crypto.randomUUID(), clientSessionId: cid, kind: "finish", at: now },
      ],
      { sessions: {}, sets: {} },
      createTransport("test-device"),
    );

    const mine = await api.loadMyWorkouts();
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ activity: "walk", state: "submitted", workout_scores: null });
    expect(await api.loadMyWorkout(mine[0].id)).toMatchObject({ id: mine[0].id });

    const activity = await api.loadSquadActivity();
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({ display_name: "Hana", activity: "walk", is_me: true, status: "submitted", points: 0 });
    expect(Object.keys(activity[0]).some((k) => /lat|lng|route|distance|heart/.test(k))).toBe(false);
  });
});

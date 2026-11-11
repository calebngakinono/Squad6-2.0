import type { Database } from "@squad-six/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Runs the real squad API against a LOCAL Supabase (never staging/production). Skipped unless
// SQUADS_IT_URL and SQUADS_IT_KEY are set, e.g.:
//   SQUADS_IT_URL=http://127.0.0.1:25321 SQUADS_IT_KEY=<local publishable key> pnpm test
const url = process.env.SQUADS_IT_URL;
const key = process.env.SQUADS_IT_KEY;
const isLocal = !!url && /^http:\/\/(127\.0\.0\.1|localhost)/.test(url);

// api.ts imports the app's client; swap in whichever test user is "signed in".
const current: { client: SupabaseClient<Database> | null } = { client: null };
vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return current.client;
  },
}));

const newUser = async (label: string) => {
  const client = createClient<Database>(url!, key!, { auth: { persistSession: false } });
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: "test-password-123" });
  if (error) throw error;
  return { client, id: data.user!.id };
};

describe.skipIf(!isLocal)("squad API against local Supabase", () => {
  let api: typeof import("./api");
  beforeAll(async () => {
    api = await import("./api");
  });

  it("create → share code → request → approve → both see the squad", async () => {
    const captain = await newUser("captain");
    const athlete = await newUser("athlete");

    current.client = captain.client;
    await api.squadApi.setDisplayName(captain.id, "Cap");
    await api.squadApi.create("Integration Squad", "Denver", "");
    const capHome = await api.loadSquadHome(captain.id);
    expect(capHome.kind).toBe("in-squad");
    const code = capHome.kind === "in-squad" ? capHome.squad.inviteCode! : "";
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

    current.client = athlete.client;
    await api.squadApi.setDisplayName(athlete.id, "Ath");
    expect(await api.squadApi.preview(code.toLowerCase())).toMatchObject({ name: "Integration Squad", member_count: 1 });
    await api.squadApi.requestToJoin(code);
    const waiting = await api.loadSquadHome(athlete.id);
    expect(waiting).toMatchObject({ kind: "no-squad", pending: [{ squadName: "Integration Squad", city: "Denver" }] });

    current.client = captain.client;
    const withRequest = await api.loadSquadHome(captain.id);
    const request = withRequest.kind === "in-squad" ? withRequest.squad.requests[0] : undefined;
    expect(request).toMatchObject({ name: "Ath" });
    await api.squadApi.decide(request!.id, true);

    current.client = athlete.client;
    const joined = await api.loadSquadHome(athlete.id);
    expect(joined.kind).toBe("in-squad");
    if (joined.kind === "in-squad") {
      expect(joined.squad.myRole).toBe("member");
      expect(joined.squad.members.map((m) => m.name)).toEqual(["Cap", "Ath"]);
      expect(joined.squad.requests).toEqual([]); // members don't see requests
    }
  });

  it("returns stable error codes the app maps to text", async () => {
    const u = await newUser("solo");
    current.client = u.client;
    await expect(api.squadApi.requestToJoin("ZZZZZZZZ")).rejects.toMatchObject({ message: "invalid_invite_code" });
    await api.squadApi.create("Solo", "Boulder", "");
    await expect(api.squadApi.create("Again", "Boulder", "")).rejects.toMatchObject({ message: "already_in_squad" });
  });
});

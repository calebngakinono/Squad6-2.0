import { joinRequestDetailSchema, joinRequestInputSchema } from "@squad-six/shared";

import { supabase } from "@/lib/supabase";

// Reads use RLS-filtered tables; every change goes through a database function (the server enforces rules).

/** A teammate: name and city only (never a precise location). */
export type Member = { userId: string; name: string | null; city: string | null; role: "captain" | "member"; joinedAt: string };
/** Where the squad competes this season, and a planned change from a later season. */
export type HomeCity = { city: string | null; cityId: number | null; next: { city: string; cityId: number; fromSeason: number } | null };
/** A pending request as the captain sees it. Season figures are the server's records. */
export type JoinRequest = {
  id: string;
  userId: string;
  name: string | null;
  createdAt: string;
  note: string | null;
  city: string | null;
  country: string | null;
  memberSince: string;
  season: number;
  seasonWorkouts: number;
  seasonPoints: number;
};
export type MySquad = {
  id: string;
  name: string;
  city: string;
  description: string | null;
  myRole: "captain" | "member";
  /** This season's home city and any planned change; null if it couldn't be read. */
  homeCity: HomeCity | null;
  members: Member[];
  inviteCode: string | null;
  requests: JoinRequest[]; // Only filled for the captain.
};
export type MyPendingRequest = { id: string; squadName: string; city: string; createdAt: string };

export type SquadHome =
  | { kind: "in-squad"; squad: MySquad }
  | { kind: "no-squad"; pending: MyPendingRequest[] };

async function people(userIds: string[]): Promise<Map<string, { name: string | null; city: string | null }>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, display_name, city").in("id", userIds);
  if (error) throw error;
  return new Map(data.map((p) => [p.id, { name: p.display_name, city: p.city }]));
}

/** My squad's home city this season and any planned change (members only). */
export async function loadHomeCity(): Promise<HomeCity> {
  const { data, error } = await supabase.rpc("my_squad_home_city");
  if (error) throw error;
  const row = data?.[0];
  return {
    city: row?.city ?? null,
    cityId: row?.city_id ?? null,
    next:
      row?.next_city && row.next_city_id != null && row.next_from_season != null
        ? { city: row.next_city, cityId: row.next_city_id, fromSeason: row.next_from_season }
        : null,
  };
}

export async function loadSquadHome(userId: string): Promise<SquadHome> {
  const { data: membership, error } = await supabase
    .from("squad_members")
    .select("squad_id, role")
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (error) throw error;

  if (!membership) {
    const { data: reqs, error: reqErr } = await supabase
      .from("squad_join_requests")
      .select("id, created_at, squads(name, city)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (reqErr) throw reqErr;
    return {
      kind: "no-squad",
      pending: reqs.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        squadName: r.squads?.name ?? "Squad",
        city: r.squads?.city ?? "",
      })),
    };
  }

  const squadId = membership.squad_id;
  const isCaptain = membership.role === "captain";
  const [squadRes, membersRes, codeRes, reqRes] = await Promise.all([
    supabase.from("squads").select("id, name, city, description").eq("id", squadId).single(),
    supabase
      .from("squad_members")
      .select("user_id, role, joined_at")
      .eq("squad_id", squadId)
      .is("left_at", null)
      .order("joined_at"),
    supabase.from("squad_invite_codes").select("code").eq("squad_id", squadId).maybeSingle(),
    isCaptain
      ? supabase.rpc("squad_join_request_details", { target_squad: squadId })
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [squadRes, membersRes, codeRes, reqRes]) if (r.error) throw r.error;

  const memberRows = membersRes.data ?? [];
  const requestRows = joinRequestDetailSchema.array().parse(reqRes.data ?? []);
  const [peopleMap, home] = await Promise.all([people(memberRows.map((m) => m.user_id)), loadHomeCity().catch(() => null)]);

  return {
    kind: "in-squad",
    squad: {
      id: squadRes.data!.id,
      name: squadRes.data!.name,
      // The home city for this season (it can differ from the founding city from a later season on).
      city: home?.city ?? squadRes.data!.city,
      homeCity: home,
      description: squadRes.data!.description,
      myRole: isCaptain ? "captain" : "member",
      inviteCode: codeRes.data?.code ?? null,
      members: memberRows.map((m) => ({
        userId: m.user_id,
        name: peopleMap.get(m.user_id)?.name ?? null,
        city: peopleMap.get(m.user_id)?.city ?? null,
        role: m.role === "captain" ? "captain" : "member",
        joinedAt: m.joined_at,
      })),
      requests: requestRows.map((r) => ({
        id: r.request_id,
        userId: r.user_id,
        name: r.display_name,
        createdAt: r.requested_at,
        note: r.note,
        city: r.city,
        country: r.country,
        memberSince: r.member_since,
        season: r.season,
        seasonWorkouts: r.season_workouts,
        seasonPoints: r.season_points,
      })),
    },
  };
}

async function call<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export const squadApi = {
  /** Captain: the squad's home city from next season (choosing the current one cancels a plan). */
  setHomeCity: (cityId: number) => call(supabase.rpc("set_squad_home_city", { new_city: cityId })),
  create: (name: string, cityId: number, description: string) =>
    call(supabase.rpc("create_squad", { squad_name: name, squad_city_id: cityId, squad_description: description })),
  preview: async (code: string) => (await call(supabase.rpc("preview_squad", { invite_code: code })))?.[0] ?? null,
  /** Ask to join with an optional note for the captain (validated before it is sent). */
  requestToJoin: (code: string, note?: string) =>
    call(supabase.rpc("request_to_join", joinRequestInputSchema.parse({ invite_code: code, note }))),
  cancelRequest: (id: string) => call(supabase.rpc("cancel_join_request", { request_id: id })),
  decide: (id: string, approve: boolean) => call(supabase.rpc("decide_join_request", { request_id: id, approve })),
  leave: () => call(supabase.rpc("leave_squad")),
  remove: (userId: string) => call(supabase.rpc("remove_squad_member", { member_user: userId })),
  makeCaptain: (userId: string) => call(supabase.rpc("transfer_captaincy", { new_captain: userId })),
  newInviteCode: () => call(supabase.rpc("regenerate_invite_code")),
  setDisplayName: async (userId: string, name: string) => {
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", userId);
    if (error) throw error;
  },
  getDisplayName: async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("display_name").eq("id", userId).single();
    if (error) throw error;
    return data.display_name;
  },
};

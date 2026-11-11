import { supabase } from "@/lib/supabase";

// Reads use RLS-filtered tables; every change goes through a database function (the server enforces rules).

export type Member = { userId: string; name: string | null; role: "captain" | "member"; joinedAt: string };
export type JoinRequest = { id: string; userId: string; name: string | null; createdAt: string };
export type MySquad = {
  id: string;
  name: string;
  city: string;
  description: string | null;
  myRole: "captain" | "member";
  members: Member[];
  inviteCode: string | null;
  requests: JoinRequest[]; // Only filled for the captain.
};
export type MyPendingRequest = { id: string; squadName: string; city: string; createdAt: string };

export type SquadHome =
  | { kind: "in-squad"; squad: MySquad }
  | { kind: "no-squad"; pending: MyPendingRequest[] };

async function names(userIds: string[]): Promise<Map<string, string | null>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
  if (error) throw error;
  return new Map(data.map((p) => [p.id, p.display_name]));
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
      ? supabase
          .from("squad_join_requests")
          .select("id, user_id, created_at")
          .eq("squad_id", squadId)
          .eq("status", "pending")
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [squadRes, membersRes, codeRes, reqRes]) if (r.error) throw r.error;

  const memberRows = membersRes.data ?? [];
  const requestRows = reqRes.data ?? [];
  const nameMap = await names([...memberRows.map((m) => m.user_id), ...requestRows.map((r) => r.user_id)]);

  return {
    kind: "in-squad",
    squad: {
      id: squadRes.data!.id,
      name: squadRes.data!.name,
      city: squadRes.data!.city,
      description: squadRes.data!.description,
      myRole: isCaptain ? "captain" : "member",
      inviteCode: codeRes.data?.code ?? null,
      members: memberRows.map((m) => ({
        userId: m.user_id,
        name: nameMap.get(m.user_id) ?? null,
        role: m.role === "captain" ? "captain" : "member",
        joinedAt: m.joined_at,
      })),
      requests: requestRows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        name: nameMap.get(r.user_id) ?? null,
        createdAt: r.created_at,
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
  create: (name: string, city: string, description: string) =>
    call(supabase.rpc("create_squad", { squad_name: name, squad_city: city, squad_description: description })),
  preview: async (code: string) => (await call(supabase.rpc("preview_squad", { invite_code: code })))?.[0] ?? null,
  requestToJoin: (code: string) => call(supabase.rpc("request_to_join", { invite_code: code })),
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

import { chatMessageSchema, chatReactionSchema, type ChatMessage, type ChatReaction, type Reaction } from "@squad-six/shared";
import { supabase } from "@/lib/supabase";

// Squad chat. Reads go through row-level security (current members only); every write is a server
// function, so nobody can post as someone else or put made-up points into a workout share.

export const PAGE = 40;
const COLUMNS = "id, squad_id, user_id, kind, body, workout, created_at, deleted_at";

const parse = (rows: unknown[] | null): ChatMessage[] =>
  (rows ?? []).flatMap((r) => {
    const p = chatMessageSchema.safeParse(r);
    return p.success ? [p.data] : [];
  });

/** A page of messages, newest first; `before` pages further back. */
export async function loadMessages(squadId: string, before?: string): Promise<ChatMessage[]> {
  let q = supabase.from("squad_messages").select(COLUMNS).eq("squad_id", squadId).order("created_at", { ascending: false }).limit(PAGE);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw error;
  return parse(data);
}

/** One message (after a realtime notice). */
export async function loadMessage(id: string): Promise<ChatMessage | null> {
  const { data, error } = await supabase.from("squad_messages").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return parse(data ? [data] : [])[0] ?? null;
}

export async function loadReactions(messageIds: string[]): Promise<ChatReaction[]> {
  if (messageIds.length === 0) return [];
  const { data, error } = await supabase.from("squad_message_reactions").select("message_id, user_id, reaction").in("message_id", messageIds);
  if (error) throw error;
  return (data ?? []).flatMap((r) => {
    const p = chatReactionSchema.safeParse(r);
    return p.success ? [p.data] : [];
  });
}

export const chatApi = {
  send: async (body: string) => {
    const { error } = await supabase.rpc("send_squad_message", { body });
    if (error) throw error;
  },
  shareWorkout: async (sessionId: string, body?: string) => {
    const { error } = await supabase.rpc("share_workout_to_squad", { target: sessionId, body });
    if (error) throw error;
  },
  remove: async (id: string) => {
    const { error } = await supabase.rpc("delete_squad_message", { target: id });
    if (error) throw error;
  },
  react: async (id: string, reaction: Reaction) => {
    const { error } = await supabase.rpc("toggle_squad_reaction", { target: id, reaction });
    if (error) throw error;
  },
  report: async (id: string, reason?: string) => {
    const { error } = await supabase.rpc("report_squad_message", { target: id, reason });
    if (error) throw error;
  },
  markRead: async () => {
    await supabase.rpc("mark_squad_chat_read");
  },
  unread: async (): Promise<number> => {
    const { data, error } = await supabase.rpc("my_squad_chat_unread");
    if (error) throw error;
    return data ?? 0;
  },
};

const ERRORS: Record<string, string> = {
  message_empty: "Write something first.",
  message_too_long: "Keep it under 2,000 characters.",
  slow_down: "That's a lot of messages at once. Wait a moment, then send again.",
  not_in_squad: "You're not in a squad anymore.",
  message_not_found: "That message is no longer here.",
  not_allowed: "Only the sender or the captain can delete a message.",
  workout_not_found: "That workout isn't yours to share.",
  workout_not_finished: "Finish the workout before sharing it.",
};

export function chatErrorMessage(e: unknown): string {
  const code = (e as { message?: string } | null)?.message?.trim() ?? "";
  return ERRORS[code] ?? "Couldn't reach Squad Six. Check your connection and try again.";
}

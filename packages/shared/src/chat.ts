import { z } from "zod";

// Squad chat as the server stores it (supabase/migrations/*_squad_chat.sql). Messages are written only
// through the chat functions; a shared workout's numbers are the server's snapshot, never the sender's.

export const REACTIONS = [
  { value: "like", glyph: "👍", label: "Like" },
  { value: "strong", glyph: "💪", label: "Strong" },
  { value: "fire", glyph: "🔥", label: "Fire" },
  { value: "clap", glyph: "👏", label: "Clap" },
] as const;
export type Reaction = (typeof REACTIONS)[number]["value"];

export const CHAT_MAX_LENGTH = 2000;

export const workoutShareSchema = z.object({
  activity: z.string(),
  active_minutes: z.number(),
  local_date: z.string(),
  /** counted: points from the scorer. unverified: timer only. other: in review, not scored, … */
  outcome: z.enum(["counted", "unverified", "other"]),
  points: z.number().int(),
});
export type WorkoutShare = z.infer<typeof workoutShareSchema>;

export const chatMessageSchema = z.object({
  id: z.string(),
  squad_id: z.string(),
  user_id: z.string(),
  kind: z.enum(["text", "workout"]),
  body: z.string().nullable(),
  workout: workoutShareSchema.nullable().catch(null),
  created_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatReactionSchema = z.object({
  message_id: z.string(),
  user_id: z.string(),
  reaction: z.enum(["like", "strong", "fire", "clap"]),
});
export type ChatReaction = z.infer<typeof chatReactionSchema>;

export type ReactionCount = { reaction: Reaction; count: number; mine: boolean };

/** Reactions per message, in the fixed order, with counts and whether I gave each one. */
export function groupReactions(reactions: ChatReaction[], myUserId: string): Map<string, ReactionCount[]> {
  const byMessage = new Map<string, ChatReaction[]>();
  for (const r of reactions) byMessage.set(r.message_id, [...(byMessage.get(r.message_id) ?? []), r]);
  const out = new Map<string, ReactionCount[]>();
  for (const [id, list] of byMessage) {
    out.set(
      id,
      REACTIONS.map(({ value }) => {
        const these = list.filter((r) => r.reaction === value);
        return { reaction: value, count: these.length, mine: these.some((r) => r.user_id === myUserId) };
      }).filter((c) => c.count > 0),
    );
  }
  return out;
}

/** Newest first, without duplicates (a realtime insert can arrive after the page that already had it). */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

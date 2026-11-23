import { describe, expect, it } from "vitest";
import { chatMessageSchema, groupReactions, mergeMessages, type ChatMessage } from "./chat";

const msg = (id: string, at: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id, squad_id: "s", user_id: "u1", kind: "text", body: "hi", workout: null, created_at: at, deleted_at: null, ...over,
});

describe("groupReactions", () => {
  it("counts each reaction in the fixed order and marks mine", () => {
    const g = groupReactions(
      [
        { message_id: "m1", user_id: "u2", reaction: "fire" },
        { message_id: "m1", user_id: "me", reaction: "fire" },
        { message_id: "m1", user_id: "u3", reaction: "like" },
      ],
      "me",
    );
    expect(g.get("m1")).toEqual([
      { reaction: "like", count: 1, mine: false },
      { reaction: "fire", count: 2, mine: true },
    ]);
    expect(g.get("m2")).toBeUndefined();
  });
});

describe("mergeMessages", () => {
  it("keeps newest first and replaces a message seen twice (e.g. deleted later)", () => {
    const merged = mergeMessages([msg("a", "2026-11-22T10:00:00Z"), msg("b", "2026-11-22T11:00:00Z")], [
      msg("a", "2026-11-22T10:00:00Z", { body: null, deleted_at: "2026-11-22T12:00:00Z" }),
      msg("c", "2026-11-22T12:00:00Z"),
    ]);
    expect(merged.map((m) => m.id)).toEqual(["c", "b", "a"]);
    expect(merged[2].deleted_at).not.toBeNull();
  });
});

describe("chatMessageSchema", () => {
  it("reads a workout share, and a deleted one as having no workout", () => {
    const share = chatMessageSchema.parse({
      ...msg("w", "2026-11-22T10:00:00Z"), kind: "workout", body: null,
      workout: { activity: "run", active_minutes: 30, local_date: "2026-11-22", outcome: "counted", points: 214 },
    });
    expect(share.workout?.points).toBe(214);
    expect(chatMessageSchema.parse({ ...msg("w", "2026-11-22T10:00:00Z"), kind: "workout", workout: {} }).workout).toBeNull();
  });
});

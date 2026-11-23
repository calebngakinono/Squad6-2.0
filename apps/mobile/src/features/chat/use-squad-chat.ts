import { chatMessageSchema, mergeMessages, type ChatMessage, type ChatReaction } from "@squad-six/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { chatApi, loadMessages, loadReactions, PAGE } from "./api";
import { refreshUnread } from "./unread";

/** How often reactions are read again while the chat is open (someone taking one back isn't pushed). */
const REACTIONS_REFRESH_MS = 20_000;

/**
 * One squad's chat, kept live: the newest page on open, older pages on demand, and new or deleted
 * messages pushed by Supabase Realtime (which applies the same members-only rules as a normal read).
 */
export function useSquadChat(squadId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [reactions, setReactions] = useState<ChatReaction[]>([]);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const ids = useRef<string[]>([]);

  const refreshReactions = useCallback(async () => {
    const list = await loadReactions(ids.current).catch(() => null);
    if (list) setReactions(list);
  }, []);

  // The latest page, and live updates from then on.
  useEffect(() => {
    if (!squadId) return;
    let live = true;
    loadMessages(squadId).then(
      (page) => {
        if (!live) return;
        ids.current = page.map((m) => m.id);
        setMessages(page);
        setHasMore(page.length === PAGE);
        void refreshReactions();
      },
      () => live && setError(true),
    );

    const onMessage = (payload: { new: unknown }) => {
      const parsed = chatMessageSchema.safeParse(payload.new);
      if (!parsed.success) return;
      ids.current = [...new Set([parsed.data.id, ...ids.current])];
      setMessages((current) => mergeMessages(current ?? [], [parsed.data]));
    };
    const filter = `squad_id=eq.${squadId}`;
    const channel = supabase
      .channel(`squad-chat:${squadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "squad_messages", filter }, onMessage)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "squad_messages", filter }, onMessage)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "squad_message_reactions", filter }, () => void refreshReactions())
      .subscribe();
    const timer = setInterval(() => void refreshReactions(), REACTIONS_REFRESH_MS);

    return () => {
      live = false;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [squadId, refreshReactions]);

  const loadOlder = useCallback(async () => {
    if (!squadId || !messages || !hasMore || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await loadMessages(squadId, messages[messages.length - 1]?.created_at);
      ids.current = [...ids.current, ...page.map((m) => m.id)];
      setMessages((current) => mergeMessages(current ?? [], page));
      setHasMore(page.length === PAGE);
      void refreshReactions();
    } catch {
      // Keep what is shown; scrolling up again retries.
    } finally {
      setLoadingOlder(false);
    }
  }, [squadId, messages, hasMore, loadingOlder, refreshReactions]);

  // Mark the chat read whenever newer messages are on screen.
  const newest = messages?.[0]?.id;
  useEffect(() => {
    if (newest) void chatApi.markRead().then(refreshUnread);
  }, [newest]);

  return { messages, reactions, error, hasMore, loadingOlder, loadOlder, refreshReactions };
}

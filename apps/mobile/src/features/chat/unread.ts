import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { chatApi } from "./api";

// Unread squad-chat messages, for the Squad tab's badge and the chat row. Read from the server when
// the app comes to the front, every 30 seconds while it is open, and right after the chat is read.
// (Push notifications come after launch.)

let count = 0;
const listeners = new Set<() => void>();

export async function refreshUnread(): Promise<void> {
  const next = await chatApi.unread().catch(() => count);
  if (next !== count) {
    count = next;
    listeners.forEach((l) => l());
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The unread count; keeps it fresh while any component using it is mounted. */
export function useUnread(): number {
  useEffect(() => {
    void refreshUnread();
    const timer = setInterval(() => void refreshUnread(), 30_000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && void refreshUnread());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return useSyncExternalStore(subscribe, () => count);
}

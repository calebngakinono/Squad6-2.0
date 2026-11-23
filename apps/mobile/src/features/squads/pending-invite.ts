import Storage from "expo-sqlite/kv-store";
import { normalizeInviteCode } from "./errors";

// An invite code from a link that opened the app, kept on the phone until it is used. A new person
// taps an invite link, goes through onboarding and creates an account; the code waits here and Join
// opens with it afterwards. Not secret (anyone with the code may only ask to join).
const KEY = "squadsix.pending-invite.v1";

export async function savePendingInvite(code: string): Promise<void> {
  const clean = normalizeInviteCode(code);
  if (clean) await Storage.setItem(KEY, clean).catch(() => {});
}

export async function readPendingInvite(): Promise<string | null> {
  const raw = await Storage.getItem(KEY).catch(() => null);
  return raw ? normalizeInviteCode(raw) : null;
}

export async function clearPendingInvite(): Promise<void> {
  await Storage.removeItem(KEY).catch(() => {});
}

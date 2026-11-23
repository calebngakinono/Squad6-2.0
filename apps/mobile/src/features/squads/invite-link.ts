import { normalizeInviteCode } from "./errors";

/**
 * The invite code in a link that opened the app, or null. Accepts the app's own link
 * (squadsix://join?code=…) and the bare path Expo Router hands over (/join?code=…). Pure, so it is
 * unit-tested; never throws.
 */
export function inviteCodeFromPath(path: string): string | null {
  const match = /(?:^|[/:])join\?(?:[^#]*&)?code=([^&#]+)/i.exec(path);
  if (!match) return null;
  try {
    return normalizeInviteCode(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

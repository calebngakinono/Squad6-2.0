import { inviteCodeFromPath } from "@/features/squads/invite-link";
import { savePendingInvite } from "@/features/squads/pending-invite";

// Every link that opens the app passes through here first. An invite link's code is saved on the
// phone, so it survives onboarding and sign-up (Join is only reachable once signed in); the path itself
// goes on unchanged. Must never throw: an error here can crash the app on launch.
export async function redirectSystemPath({ path }: { path: string; initial: boolean }): Promise<string> {
  try {
    const code = inviteCodeFromPath(path);
    if (code) await savePendingInvite(code);
  } catch {
    // Keep going: the link still opens.
  }
  return path;
}

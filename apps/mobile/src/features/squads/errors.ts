// Squad functions raise stable codes (see the squads migration). Map them to plain language here.
const MESSAGES: Record<string, string> = {
  already_in_squad: "You're already in a squad. Leave it first to join or start another.",
  squad_creation_limit: "You've started 3 squads in the last 30 days. Try again later.",
  invalid_invite_code: "That code doesn't match an active squad. Check it and try again.",
  squad_full: "This squad already has six members.",
  too_many_pending_requests: "You have 3 requests waiting. Cancel one before asking another squad.",
  request_not_found: "That request is no longer available.",
  request_already_decided: "That request was already handled.",
  requester_in_other_squad: "They've already joined another squad.",
  member_not_found: "That member is no longer in the squad.",
  not_captain: "Only the captain can do that.",
  not_in_squad: "You're not in a squad.",
  not_signed_in: "Please sign in again.",
  city_required: "Choose the squad's city from the list.",
};

export function squadErrorMessage(error: { message?: string } | null | undefined): string {
  const code = error?.message?.trim() ?? "";
  return MESSAGES[code] ?? "Something went wrong. Check your connection and try again.";
}

/** Invite codes: 8 characters, no look-alikes. Normalizes user input; returns null if it can't be valid. */
export function normalizeInviteCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-HJ-NP-Z2-9]{8}$/.test(code) ? code : null;
}

export const inviteLink = (code: string) => `squadsix://join?code=${code}`;

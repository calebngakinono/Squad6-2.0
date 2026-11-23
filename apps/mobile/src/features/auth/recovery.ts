// Password reset by emailed code. Pure, so it is unit-tested.

export const MIN_PASSWORD_LENGTH = 8; // the same as sign-up and supabase/config.toml

/** Why a new password can't be used, or null when it can. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  return null;
}

/** Plain words for the errors Supabase Auth gives during a reset. */
export function recoveryErrorMessage(error: { message?: string; status?: number; code?: string } | null | undefined): string {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (text.includes("expired") || text.includes("invalid") || text.includes("otp")) {
    return "That code didn't work. Check it, or send a new one (each code works for one hour).";
  }
  if (error?.status === 429 || text.includes("rate limit") || text.includes("seconds")) {
    return "Too many tries. Wait a minute, then try again.";
  }
  if (text.includes("different from the old") || text.includes("same_password")) return "Choose a password you haven't used for this account.";
  if (text.includes("weak") || text.includes("password should")) return "Choose a stronger password (at least 8 characters).";
  return "Couldn't reach Squad Six. Check your connection and try again.";
}

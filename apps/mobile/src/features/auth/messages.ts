// Plain-language messages for sign-in problems. Pure, so it is unit-tested.

export function socialSignInMessage(provider: "Apple" | "Google", error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? "";
  if (/is not enabled|unsupported provider/i.test(message)) {
    return `Sign in with ${provider} isn't switched on for this server yet. Use email for now.`;
  }
  if (/audience|client id|nonce/i.test(message)) {
    return `Sign in with ${provider} isn't set up correctly on the server yet. Use email for now.`;
  }
  if (/network|fetch/i.test(message)) return "Couldn't reach Squad Six. Check your connection and try again.";
  return `Sign in with ${provider} didn't work. Try again, or use email.`;
}

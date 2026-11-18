import { describe, expect, it } from "vitest";
import { socialSignInMessage } from "./messages";

describe("socialSignInMessage", () => {
  it("explains a provider that is not switched on", () => {
    expect(socialSignInMessage("Apple", { message: "Provider (issuer \"https://appleid.apple.com\") is not enabled" })).toMatch(/isn't switched on/);
  });

  it("explains a server set up with the wrong client ID or nonce setting", () => {
    expect(socialSignInMessage("Google", { message: "Unacceptable audience in id_token" })).toMatch(/isn't set up correctly/);
    expect(socialSignInMessage("Google", { message: "Passed nonce and nonce in id_token should either both exist or not." })).toMatch(/set up correctly/);
  });

  it("falls back to a friendly message", () => {
    expect(socialSignInMessage("Google", new Error("TypeError: Network request failed"))).toMatch(/connection/);
    expect(socialSignInMessage("Apple", undefined)).toBe("Sign in with Apple didn't work. Try again, or use email.");
  });
});

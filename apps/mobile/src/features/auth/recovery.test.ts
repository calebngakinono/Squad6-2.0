import { describe, expect, it } from "vitest";
import { passwordProblem, recoveryErrorMessage } from "./recovery";

describe("passwordProblem", () => {
  it("asks for 8 characters, like sign-up", () => {
    expect(passwordProblem("short")).toMatch(/8 characters/);
    expect(passwordProblem("long-enough")).toBeNull();
  });
});

describe("recoveryErrorMessage", () => {
  it("turns Supabase's errors into plain words", () => {
    expect(recoveryErrorMessage({ message: "Token has expired or is invalid" })).toMatch(/code didn't work/);
    expect(recoveryErrorMessage({ code: "otp_expired", message: "x" })).toMatch(/code didn't work/);
    expect(recoveryErrorMessage({ status: 429, message: "For security purposes, you can only request this after 42 seconds." })).toMatch(/Too many tries/);
    expect(recoveryErrorMessage({ message: "New password should be different from the old password." })).toMatch(/haven't used/);
    expect(recoveryErrorMessage(null)).toMatch(/connection/);
  });
});

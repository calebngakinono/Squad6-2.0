import { describe, expect, it } from "vitest";
import { inviteLink, normalizeInviteCode, squadErrorMessage } from "./errors";

describe("squadErrorMessage", () => {
  it("maps known codes", () => {
    expect(squadErrorMessage({ message: "squad_full" })).toBe("This squad already has six members.");
  });
  it("falls back for unknown or missing errors without leaking internals", () => {
    expect(squadErrorMessage({ message: 'relation "x" does not exist' })).toMatch(/Something went wrong/);
    expect(squadErrorMessage(null)).toMatch(/Something went wrong/);
  });
});

describe("normalizeInviteCode", () => {
  it("accepts lowercase, spaces and dashes", () => {
    expect(normalizeInviteCode(" abcd-2345 ")).toBe("ABCD2345");
  });
  it("rejects look-alike characters and wrong lengths", () => {
    expect(normalizeInviteCode("ABCD1234")).toBeNull(); // 1 is excluded
    expect(normalizeInviteCode("ABCDO234")).toBeNull(); // O is excluded
    expect(normalizeInviteCode("ABC2345")).toBeNull();
  });
});

describe("inviteLink", () => {
  it("builds the app link", () => {
    expect(inviteLink("ABCD2345")).toBe("squadsix://join?code=ABCD2345");
  });
});

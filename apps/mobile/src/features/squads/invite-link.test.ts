import { describe, expect, it } from "vitest";
import { inviteCodeFromPath } from "./invite-link";

describe("inviteCodeFromPath", () => {
  it("finds the code in the app's own link and in the path the router sees", () => {
    expect(inviteCodeFromPath("squadsix://join?code=FE4FDC5L")).toBe("FE4FDC5L");
    expect(inviteCodeFromPath("/join?code=fe4f-dc5l")).toBe("FE4FDC5L");
    expect(inviteCodeFromPath("/join?ref=x&code=FE4FDC5L")).toBe("FE4FDC5L");
  });

  it("ignores other links and bad codes", () => {
    expect(inviteCodeFromPath("/standings")).toBeNull();
    expect(inviteCodeFromPath("/join")).toBeNull();
    expect(inviteCodeFromPath("/join?code=NOPE")).toBeNull();
    expect(inviteCodeFromPath("/join?code=%E0%A4%A")).toBeNull();
  });
});

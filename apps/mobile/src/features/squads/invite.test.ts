import { describe, expect, it } from "vitest";
import { inviteMessage, inviteReason } from "./invite";

describe("inviteReason", () => {
  it("counts down to being ranked below four members", () => {
    expect(inviteReason("Sharks", 1)).toBe("3 more members and Sharks gets ranked.");
    expect(inviteReason("Sharks", 3)).toBe("1 more member and Sharks gets ranked.");
  });
  it("counts open seats from four up, and says nothing when full", () => {
    expect(inviteReason("Sharks", 4)).toBe("Room for 2 more.");
    expect(inviteReason("Sharks", 5)).toBe("Room for 1 more.");
    expect(inviteReason("Sharks", 6)).toBeNull();
  });
});

describe("inviteMessage", () => {
  it("carries the name, the code and the link", () => {
    expect(inviteMessage("Sharks", "FE4FDC5L")).toBe('Join my squad "Sharks" on Squad Six. Code: FE4FDC5L\nsquadsix://join?code=FE4FDC5L');
  });
});

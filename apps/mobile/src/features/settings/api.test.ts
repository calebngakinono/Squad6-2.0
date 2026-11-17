import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

describe("settingsErrorMessage", async () => {
  const { settingsErrorMessage } = await import("./api");

  it("explains the weekly limit on time zone changes", () => {
    expect(settingsErrorMessage({ message: "home timezone can change once every 7 days" })).toMatch(/last 7 days/);
  });

  it("falls back to a connection message", () => {
    expect(settingsErrorMessage(new Error("fetch failed"))).toMatch(/connection/);
    expect(settingsErrorMessage(undefined)).toMatch(/connection/);
  });
});

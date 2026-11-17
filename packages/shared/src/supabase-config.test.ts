import { describe, expect, it } from "vitest";
import { parseSupabasePublicConfig } from "./supabase-config";

const names = { url: "EXPO_PUBLIC_SUPABASE_URL", publishableKey: "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" };

describe("parseSupabasePublicConfig", () => {
  it("returns validated values", () => {
    const config = parseSupabasePublicConfig(
      { url: "http://127.0.0.1:25321", publishableKey: "sb_publishable_test" },
      names,
    );
    expect(config).toEqual({ url: "http://127.0.0.1:25321", publishableKey: "sb_publishable_test" });
  });

  it("names the app's variables without leaking values", () => {
    expect(() => parseSupabasePublicConfig({ url: "not-a-url", publishableKey: undefined }, names)).toThrow(
      "Missing or invalid environment variables: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  });
});

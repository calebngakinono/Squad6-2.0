import { describe, expect, it } from "vitest";
import { colorSchemeOverride, parseAppearance } from "./appearance-choice";

describe("parseAppearance", () => {
  it("keeps light and dark, and falls back to following the phone", () => {
    expect(parseAppearance("light")).toBe("light");
    expect(parseAppearance("dark")).toBe("dark");
    expect(parseAppearance("system")).toBe("system");
    expect(parseAppearance(null)).toBe("system");
    expect(parseAppearance("sepia")).toBe("system");
  });
});

describe("colorSchemeOverride", () => {
  it("forces light or dark, or hands control back to the phone", () => {
    expect(colorSchemeOverride("light")).toBe("light");
    expect(colorSchemeOverride("dark")).toBe("dark");
    expect(colorSchemeOverride("system")).toBe("unspecified");
  });
});

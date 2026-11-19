import { describe, expect, test } from "vitest";
import { contrastRatio } from "./contrast";
import { fontFaces, minTouch, palette, resolveTextStyle, size, type, type ColorRole } from "./tokens";

// WCAG: 4.5:1 for normal text, 3:1 for large text and for control boundaries / focus indicators.
const TEXT = 4.5;
const NON_TEXT = 3;

const surfaces: ColorRole[] = ["background", "surface", "surfaceRaised"];

const pairs: [fg: ColorRole, bg: ColorRole, min: number][] = [
  ...surfaces.flatMap((bg): [ColorRole, ColorRole, number][] => [
    ["text", bg, TEXT],
    ["textMuted", bg, TEXT],
    ["accent", bg, TEXT],
    ["danger", bg, TEXT],
    ["success", bg, TEXT],
    ["warning", bg, TEXT],
    ["borderStrong", bg, NON_TEXT],
    ["focus", bg, NON_TEXT],
  ]),
  ["text", "surfaceSunken", TEXT],
  ["textMuted", "surfaceSunken", TEXT],
  ["text", "surfacePressed", TEXT],
  ["textMuted", "surfacePressed", TEXT],
  ["onAccent", "accent", TEXT],
  ["onAccent", "accentPressed", TEXT],
  ["onDanger", "danger", TEXT],
  ["onDanger", "dangerPressed", TEXT],
  ["accent", "accentSoft", TEXT],
  ["text", "accentSoft", TEXT],
  // Highlighted list rows ("your squad") put secondary text on accentSoft.
  ["textMuted", "accentSoft", TEXT],
  ["success", "successSoft", TEXT],
  ["warning", "warningSoft", TEXT],
  ["danger", "dangerSoft", TEXT],
];

describe.each(["light", "dark"] as const)("%s palette contrast", (mode) => {
  test.each(pairs)("%s on %s", (fg, bg, min) => {
    const ratio = contrastRatio(palette[mode][fg], palette[mode][bg]);
    expect(ratio, `${palette[mode][fg]} on ${palette[mode][bg]}`).toBeGreaterThanOrEqual(min);
  });
});

test("both appearances define the same color roles", () => {
  expect(Object.keys(palette.dark).sort()).toEqual(Object.keys(palette.light).sort());
});

test("controls meet the minimum touch size", () => {
  expect(size.control).toBeGreaterThanOrEqual(minTouch);
  expect(size.row).toBeGreaterThanOrEqual(minTouch);
  expect(size.tile).toBeGreaterThanOrEqual(minTouch);
});

test("every type weight has a loaded face, and the smallest size is 12pt", () => {
  for (const token of Object.values(type)) {
    expect(fontFaces[token.fontWeight]).toBeDefined();
    expect(token.fontSize).toBeGreaterThanOrEqual(12);
    expect(token.lineHeight).toBeGreaterThan(token.fontSize);
  }
});

test("resolveTextStyle swaps weight for a font face only when fonts loaded", () => {
  expect(resolveTextStyle(type.label, false)).toEqual(type.label);
  const loaded = resolveTextStyle(type.label, true);
  expect(loaded.fontFamily).toBe("Inter_500Medium");
  expect(loaded.fontWeight).toBeUndefined();
  expect(loaded.fontSize).toBe(type.label.fontSize);
});

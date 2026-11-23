// Single source of visual tokens for the app ("Trail Blaze": forest greens, sage blazes, routed-sign type).
// Screens and components read these instead of one-off colors and sizes, so a designer can replace the
// look by editing this file. See apps/mobile/DESIGN.md for what each token is for.
//
// This file must stay free of React Native runtime imports: the unit tests (Node) import it to check
// contrast. `import type` is fine.
import type { TextStyle } from "react-native";

// ---------------------------------------------------------------------------------------------------
// Color. Semantic roles, one set per appearance. The app follows the phone's light/dark setting.
// Built from Caleb's six greens: #071E15 (forest night), #2A3B2D, #284936 (forest), #26604A (emerald),
// #435341 (olive) and #ADB499 (sage). Dark is the home appearance; light is sage paper with forest ink.
// Contrast is enforced by src/theme/tokens.test.ts (body text 4.5:1, large text and controls 3:1).
// ---------------------------------------------------------------------------------------------------
export const palette = {
  light: {
    /** Screen background: sage paper. */
    background: "#E8EBDE",
    /** Cards, inputs, list groups. */
    surface: "#F4F6EE",
    /** Things that sit above a surface: selected segment, sheets. */
    surfaceRaised: "#FBFCF8",
    /** Recessed wells: segmented-control track, progress track, hollow blazes. */
    surfaceSunken: "#D9DDCB",
    /** Pressed state for rows and quiet buttons. */
    surfacePressed: "#DCE0CF",
    text: "#071E15",
    /** Secondary text, captions, placeholders. Still meets 4.5:1 on every surface. */
    textMuted: "#435341",
    /** Hairlines and dividers (decorative, not a control boundary). */
    border: "#C8CDB6",
    /** Control boundaries such as text-field outlines (3:1 against the surface). */
    borderStrong: "#6B775C",
    /** The one action colour: primary actions, selection, links, filled blazes. */
    accent: "#26604A",
    accentPressed: "#1D4D3B",
    onAccent: "#F4F6EE",
    /** Tinted background for selected or highlighted things; put `accent` text on it. */
    accentSoft: "#D3E0D2",
    /** Pressed state of something on accentSoft (the trail sign). */
    accentSoftPressed: "#C3D4C2",
    /** The trail sign's board edge (decorative, drawn 1.5pt). */
    signEdge: "#ADB499",
    /** Unfilled part of a progress track: visible against the background. */
    track: "#C8CDB6",
    success: "#26604A",
    successSoft: "#D3E0D2",
    warning: "#7A5200",
    warningSoft: "#F0E4C8",
    danger: "#A3261E",
    dangerPressed: "#821E18",
    onDanger: "#FFFFFF",
    dangerSoft: "#F3DEDA",
    /** Focus ring for the active text field. */
    focus: "#26604A",
    /** Dims content behind a sheet or dialog. */
    scrim: "rgba(7, 30, 21, 0.45)",
  },
  dark: {
    background: "#071E15",
    surface: "#0F2A1E",
    surfaceRaised: "#2A3B2D",
    surfaceSunken: "#04140D",
    surfacePressed: "#284936",
    text: "#EEF0E6",
    textMuted: "#ADB499",
    border: "#2A3B2D",
    borderStrong: "#7E8B6B",
    accent: "#ADB499",
    accentPressed: "#C3C9B1",
    onAccent: "#071E15",
    accentSoft: "#284936",
    accentSoftPressed: "#1C3829",
    signEdge: "#7E8B6B",
    track: "#2A3B2D",
    success: "#B9D9B4",
    successSoft: "#284936",
    warning: "#E3B566",
    warningSoft: "#3A2E17",
    danger: "#F2B8B5",
    dangerPressed: "#E89C98",
    onDanger: "#3A0C0A",
    dangerSoft: "#3A1F1D",
    focus: "#ADB499",
    scrim: "rgba(0, 0, 0, 0.6)",
  },
} as const;

export type ColorRole = keyof (typeof palette)["light"];
export type Palette = { [K in ColorRole]: string };

// ---------------------------------------------------------------------------------------------------
// Type. Two families, loaded at runtime in app/_layout.tsx: a condensed routed-sign face (Barlow
// Condensed) for titles and numbers, and Overpass (highway-sign lineage) for reading text and controls.
// If they fail to load, text falls back to the system font at the same sizes and weights. Numbers use
// tabular figures so timers and scores do not jitter as digits change.
// ---------------------------------------------------------------------------------------------------

/** Runtime font names registered by useFonts, per family and weight. */
export const fontFaces = {
  display: { "500": "BarlowCondensed_500Medium", "600": "BarlowCondensed_600SemiBold", "700": "BarlowCondensed_700Bold" },
  text: { "400": "Overpass_400Regular", "600": "Overpass_600SemiBold", "700": "Overpass_700Bold" },
} as const;

export type FontFamilyToken = keyof typeof fontFaces;
export type FontWeightToken = "400" | "500" | "600" | "700";

type TypeToken = TextStyle & { fontSize: number; lineHeight: number; fontWeight: FontWeightToken; family: FontFamilyToken };

// All sizes scale with the phone's text-size setting (Dynamic Type). The condensed face runs a little
// larger than a regular face at the same role.
export const type = {
  /** The live workout timer only: readable at arm's length, mid-run. */
  timer: { family: "display", fontSize: 76, lineHeight: 80, fontWeight: "600", letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  /** Hero numbers: a season total, a finished workout's points. */
  display: { family: "display", fontSize: 48, lineHeight: 52, fontWeight: "700", letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  /** The squad's name and trail-sign captions: routed-sign caps. */
  sign: { family: "display", fontSize: 32, lineHeight: 34, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  /** Screen title. One per screen. */
  title: { family: "display", fontSize: 32, lineHeight: 36, fontWeight: "700", letterSpacing: 0 },
  /** Section heading inside a screen. */
  headline: { family: "display", fontSize: 23, lineHeight: 28, fontWeight: "600", letterSpacing: 0.2 },
  /** A number that matters: distance, pace, points, rank. */
  metric: { family: "display", fontSize: 30, lineHeight: 34, fontWeight: "700", letterSpacing: 0, fontVariant: ["tabular-nums"] },
  /** Default reading text. */
  body: { family: "text", fontSize: 17, lineHeight: 25, fontWeight: "400" },
  /** Field labels, card titles, row titles. */
  label: { family: "text", fontSize: 15, lineHeight: 20, fontWeight: "600" },
  /** Text inside buttons. */
  button: { family: "text", fontSize: 16, lineHeight: 20, fontWeight: "700" },
  /** Secondary lines, helper text. */
  small: { family: "text", fontSize: 14, lineHeight: 20, fontWeight: "400" },
  /** Footnotes, data sources, badges. The smallest size (12pt) in the app. */
  caption: { family: "text", fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.3 },
} satisfies Record<string, TypeToken>;

export type TypeVariant = keyof typeof type;

/** Monospace face for raw diagnostic output only (the dev device-check report), never for UI text. */
export const monoFamily = { ios: "Menlo", default: "monospace" } as const;

/** Turns a type token into a style that uses the loaded font face (or the system font). */
export function resolveTextStyle(token: TypeToken, fontsLoaded: boolean): TextStyle {
  const { family, ...style } = token;
  if (!fontsLoaded) return style;
  // A custom face already carries its weight. Also passing fontWeight makes Android fake a bolder cut.
  const { fontWeight, ...rest } = style;
  const faces: Partial<Record<FontWeightToken, string>> = fontFaces[family];
  return { ...rest, fontFamily: faces[fontWeight] };
}

// ---------------------------------------------------------------------------------------------------
// Space, size, shape.
// ---------------------------------------------------------------------------------------------------

/** 4-point spacing scale. Tight inside a group, generous between groups. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 } as const;

export const layout = {
  /** Left and right padding of every screen. */
  gutter: space.lg,
  /** Gap between blocks on a screen. */
  sectionGap: space.xl,
  /** Inner padding of a card. */
  cardPadding: 20,
  /** Gap between items inside a card or group. */
  stackGap: space.md,
  /** Gap between a SectionHeader and the list or card it introduces. */
  headingGap: space.sm + space.xs,
} as const;

/** Small radii, like a routed trail sign: corners eased, never rounded into pills except tiny marks. */
export const radius = { sm: 4, md: 6, lg: 8, xl: 16, pill: 999 } as const;

export const borderWidth = { thin: 1, thick: 2 } as const;

/** Minimum size of anything tappable, in points (above Apple's 44 and Android's 48 dp). */
export const minTouch = 48;

export const size = {
  /** Height of a standard button or text field. Grows with larger text, never clips. */
  control: 52,
  /** Height of a compact control (pill, badge row); pad with hitSlop to reach minTouch. */
  controlCompact: 40,
  /** Minimum height of a list row. */
  row: 56,
  /** Drawn chevron in list rows. */
  chevron: 8,
  /** Width of the leading column in a list row (a rank), so titles line up. */
  leading: 32,
  /** Minimum height of a tappable tile in a grid (activity picker). */
  tile: 96,
  /** Radio and checkbox marks in choice rows. */
  mark: 22,
  /** Inner dot of a selected radio mark. */
  markDot: 10,
} as const;

// ---------------------------------------------------------------------------------------------------
// Elevation. Light mode separates layers with a soft shadow; dark mode with a lighter surface and a
// hairline, because shadows disappear on dark backgrounds. Never both on one element.
// ---------------------------------------------------------------------------------------------------
export const elevation = {
  light: {
    flat: { shadow: undefined, outline: false },
    raised: { shadow: "0px 1px 2px rgba(7, 30, 21, 0.06), 0px 6px 18px rgba(7, 30, 21, 0.07)", outline: false },
    overlay: { shadow: "0px 2px 6px rgba(7, 30, 21, 0.08), 0px 16px 40px rgba(7, 30, 21, 0.12)", outline: false },
    /** The selected thumb of a segmented control. */
    thumb: { shadow: "0px 1px 3px rgba(7, 30, 21, 0.12)", outline: false },
  },
  dark: {
    flat: { shadow: undefined, outline: false },
    raised: { shadow: undefined, outline: true },
    overlay: { shadow: "0px 16px 40px rgba(0, 0, 0, 0.5)", outline: true },
    thumb: { shadow: undefined, outline: false },
  },
} as const;

export type ElevationLevel = keyof (typeof elevation)["light"];
export type Elevation = { shadow: string | undefined; outline: boolean };

// ---------------------------------------------------------------------------------------------------
// Interaction and motion.
// ---------------------------------------------------------------------------------------------------
export const state = {
  /** Opacity of a disabled control. Busy controls stay at full opacity and show a spinner. */
  disabledOpacity: 0.42,
  /** Slight press-in on buttons and tiles. */
  pressedScale: 0.98,
  /** A bare text label pressed (header items inside the system's own glass button). */
  pressedOpacity: 0.55,
} as const;

/** Durations in ms. Motion is quiet: short, ease-out, never decorative. Honor Reduce Motion. */
export const motion = {
  duration: { instant: 90, fast: 150, base: 220, slow: 320 },
} as const;

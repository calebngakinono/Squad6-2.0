// Single source of visual tokens for the app ("clean premium": warm neutrals, one deep green accent).
// Screens and components read these instead of one-off colors and sizes, so a designer can replace the
// look by editing this file. See apps/mobile/DESIGN.md for what each token is for.
//
// This file must stay free of React Native runtime imports: the unit tests (Node) import it to check
// contrast. `import type` is fine.
import type { TextStyle } from "react-native";

// ---------------------------------------------------------------------------------------------------
// Color. Semantic roles, one set per appearance. The app follows the phone's light/dark setting.
// Contrast is enforced by src/theme/tokens.test.ts (body text 4.5:1, large text and controls 3:1).
// ---------------------------------------------------------------------------------------------------
export const palette = {
  light: {
    /** Screen background: warm paper. */
    background: "#F6F4EF",
    /** Cards, inputs, list groups. */
    surface: "#FFFEFB",
    /** Things that sit above a surface: selected segment, sheets. */
    surfaceRaised: "#FFFFFF",
    /** Recessed wells: segmented-control track, progress track. */
    surfaceSunken: "#ECE9E2",
    /** Pressed state for rows and quiet buttons. */
    surfacePressed: "#EBE7DF",
    text: "#1A1C19",
    /** Secondary text, captions, placeholders. Still meets 4.5:1 on every surface. */
    textMuted: "#5C6059",
    /** Hairlines and dividers (decorative, not a control boundary). */
    border: "#E3DFD6",
    /** Control boundaries such as text-field outlines (3:1 against the surface). */
    borderStrong: "#8A8B84",
    /** The one brand color: primary actions, selection, links. */
    accent: "#1D6A46",
    accentPressed: "#165537",
    onAccent: "#FFFFFF",
    /** Tinted background for selected or highlighted things; put `accent` text on it. */
    accentSoft: "#E3EDE5",
    success: "#2A7247",
    successSoft: "#E2F0E6",
    warning: "#8A5A00",
    warningSoft: "#F7ECD6",
    danger: "#B3261E",
    dangerPressed: "#8F1E18",
    onDanger: "#FFFFFF",
    dangerSoft: "#F8E4E1",
    /** Focus ring for the active text field. */
    focus: "#1D6A46",
    /** Dims content behind a sheet or dialog. */
    scrim: "rgba(26, 28, 25, 0.45)",
  },
  dark: {
    background: "#121411",
    surface: "#1A1D19",
    surfaceRaised: "#22261F",
    surfaceSunken: "#0C0E0B",
    surfacePressed: "#2A2E27",
    text: "#EEEDE8",
    textMuted: "#A6A9A0",
    border: "#2D312B",
    borderStrong: "#6E7368",
    accent: "#6FC59A",
    accentPressed: "#5DB286",
    onAccent: "#0E1A13",
    accentSoft: "#1E3327",
    success: "#7CCB9C",
    successSoft: "#1B3124",
    warning: "#E3B566",
    warningSoft: "#3A2E17",
    danger: "#F2B8B5",
    dangerPressed: "#E89C98",
    onDanger: "#3A0C0A",
    dangerSoft: "#3A1F1D",
    focus: "#8FD5B0",
    scrim: "rgba(0, 0, 0, 0.6)",
  },
} as const;

export type ColorRole = keyof (typeof palette)["light"];
export type Palette = { [K in ColorRole]: string };

// ---------------------------------------------------------------------------------------------------
// Type. One family (Inter, loaded at runtime in app/_layout.tsx). If it fails to load, text falls back
// to the system font at the same sizes and weights. Numbers use tabular figures so timers and
// scores do not jitter as digits change.
// ---------------------------------------------------------------------------------------------------

/** Runtime font names registered by useFonts, one per weight the scale uses. */
export const fontFaces = {
  "400": "Inter_400Regular",
  "500": "Inter_500Medium",
  "600": "Inter_600SemiBold",
} as const;

export type FontWeightToken = keyof typeof fontFaces;

type TypeToken = TextStyle & { fontSize: number; lineHeight: number; fontWeight: FontWeightToken };

// Existing names (title, body, label, small, metric) keep working; display, headline, button and
// caption were added. All sizes scale with the phone's text-size setting (Dynamic Type).
export const type = {
  /** Hero numbers: the live workout timer, a season total. */
  display: { fontSize: 44, lineHeight: 52, fontWeight: "600", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  /** Screen title. One per screen. */
  title: { fontSize: 30, lineHeight: 36, fontWeight: "600", letterSpacing: -0.6 },
  /** Section heading inside a screen. */
  headline: { fontSize: 20, lineHeight: 26, fontWeight: "600", letterSpacing: -0.3 },
  /** A number that matters: distance, pace, points, rank. */
  metric: { fontSize: 28, lineHeight: 34, fontWeight: "600", letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  /** Default reading text. */
  body: { fontSize: 17, lineHeight: 25, fontWeight: "400" },
  /** Field labels, card titles, row titles. */
  label: { fontSize: 15, lineHeight: 20, fontWeight: "500" },
  /** Text inside buttons. */
  button: { fontSize: 16, lineHeight: 20, fontWeight: "600" },
  /** Secondary lines, helper text. */
  small: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  /** Footnotes, data sources, badges. The smallest size (12pt) in the app. */
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500", letterSpacing: 0.2 },
} satisfies Record<string, TypeToken>;

export type TypeVariant = keyof typeof type;

/** Turns a type token into a style that uses the loaded font face (or the system font). */
export function resolveTextStyle(token: TypeToken, fontsLoaded: boolean): TextStyle {
  if (!fontsLoaded) return token;
  // A custom face already carries its weight. Also passing fontWeight makes Android fake a bolder cut.
  const { fontWeight, ...rest } = token;
  return { ...rest, fontFamily: fontFaces[fontWeight] };
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
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

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
} as const;

// ---------------------------------------------------------------------------------------------------
// Elevation. Light mode separates layers with a soft shadow; dark mode with a lighter surface and a
// hairline, because shadows disappear on dark backgrounds. Never both on one element.
// ---------------------------------------------------------------------------------------------------
export const elevation = {
  light: {
    flat: { shadow: undefined, outline: false },
    raised: { shadow: "0px 1px 2px rgba(31, 33, 28, 0.05), 0px 6px 18px rgba(31, 33, 28, 0.06)", outline: false },
    overlay: { shadow: "0px 2px 6px rgba(31, 33, 28, 0.08), 0px 16px 40px rgba(31, 33, 28, 0.12)", outline: false },
    /** The selected thumb of a segmented control. */
    thumb: { shadow: "0px 1px 3px rgba(31, 33, 28, 0.12)", outline: false },
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
} as const;

/** Durations in ms. Motion is quiet: short, ease-out, never decorative. Honor Reduce Motion. */
export const motion = {
  duration: { instant: 90, fast: 150, base: 220, slow: 320 },
} as const;

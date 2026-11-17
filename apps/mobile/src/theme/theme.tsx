import { createContext, useContext, type ReactNode } from "react";
import { useColorScheme, type TextStyle } from "react-native";
import { borderWidth, elevation, palette, resolveTextStyle, type, type Elevation, type ElevationLevel, type Palette, type TypeVariant } from "./tokens";

// Whether the brand font finished loading. False means the system font is used (still fully styled).
const FontsLoadedContext = createContext(false);

/** Wrap the app once (app/_layout.tsx) after fonts loaded or failed. */
export function ThemeProvider({ fontsLoaded, children }: { fontsLoaded: boolean; children: ReactNode }) {
  return <FontsLoadedContext.Provider value={fontsLoaded}>{children}</FontsLoadedContext.Provider>;
}

export type Theme = {
  mode: "light" | "dark";
  color: Palette;
  elevation: Record<ElevationLevel, Elevation>;
  fontsLoaded: boolean;
  /** A type-scale style that uses the brand font when it loaded. */
  text: (variant: TypeVariant) => TextStyle;
};

/** Everything a component needs to style itself for the current appearance. */
export function useTheme(): Theme {
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const fontsLoaded = useContext(FontsLoadedContext);
  return {
    mode,
    color: palette[mode],
    elevation: elevation[mode],
    fontsLoaded,
    text: (variant) => resolveTextStyle(type[variant], fontsLoaded),
  };
}

/** Converts an elevation token into view styles (soft shadow in light mode, hairline in dark mode). */
export function elevationStyle(level: Elevation, color: Palette) {
  return {
    ...(level.shadow ? { boxShadow: level.shadow } : null),
    ...(level.outline ? { borderWidth: borderWidth.thin, borderColor: color.border } : null),
  };
}

import { useColorScheme } from "react-native";
import { palette, type Palette } from "./tokens";

/** The color roles for the phone's current appearance. Prefer `useTheme()` in new components. */
export function usePalette(): Palette {
  return useColorScheme() === "dark" ? palette.dark : palette.light;
}

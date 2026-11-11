import { useColorScheme } from "react-native";
import { palette, type Palette } from "./tokens";

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? palette.dark : palette.light;
}

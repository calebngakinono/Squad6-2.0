import type { ComponentProps } from "react";
import type { Stack } from "expo-router";
import { useTheme } from "./theme";

type StackOptions = NonNullable<ComponentProps<typeof Stack>["screenOptions"]>;

/**
 * The native header look for every Stack (the root one and the one inside each tab): theme ground,
 * sage back arrow, Overpass title, no shadow. Headers are off unless a screen turns them on.
 */
export function useStackOptions(): StackOptions {
  const t = useTheme();
  return {
    headerShown: false,
    headerStyle: { backgroundColor: t.color.background },
    headerTintColor: t.color.accent,
    headerTitleStyle: {
      color: t.color.text,
      fontFamily: t.text("button").fontFamily,
      fontSize: t.text("button").fontSize,
      fontWeight: t.text("button").fontWeight,
    },
    headerShadowVisible: false,
    // Back arrow only: the previous screen's title next to it crowds the centered title.
    headerBackButtonDisplayMode: "minimal",
    contentStyle: { backgroundColor: t.color.background },
  };
}

import { Pressable, StyleSheet } from "react-native";
import { T } from "@/components/screen-text";
import { elevationStyle, useTheme } from "@/theme/theme";
import { layout, radius, size, space, state } from "@/theme/tokens";

type Props = {
  title: string;
  /** One short line about what happens ("GPS", "Log sets"). */
  caption?: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

// A large tappable card for a grid of choices that start something (the activity picker). Lay tiles
// out in a Grid so they share the width.
export function Tile({ title, caption, onPress, accessibilityLabel, accessibilityHint }: Props) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: pressed ? t.color.surfacePressed : t.color.surface },
        elevationStyle(t.elevation.raised, t.color),
        pressed && { transform: [{ scale: state.pressedScale }] },
      ]}
    >
      <T variant="headline">{title}</T>
      {caption ? (
        <T variant="small" tone="textMuted">
          {caption}
        </T>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    // Two per row in a Grid: each takes just under half, and the gap fills the rest.
    flexBasis: "45%",
    flexGrow: 1,
    minHeight: size.tile,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    padding: layout.cardPadding - space.xs,
    justifyContent: "space-between",
    gap: space.sm,
  },
});

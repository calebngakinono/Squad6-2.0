import { Pressable, StyleSheet, View } from "react-native";
import { T } from "@/components/screen-text";
import { useTheme } from "@/theme/theme";
import { borderWidth, radius, size, space } from "@/theme/tokens";

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** radio: one of a set (a round mark). Otherwise a checkbox: any number of a set (a square mark). */
  radio?: boolean;
  disabled?: boolean;
};

// A full-width answer row with a radio or checkbox mark: onboarding questions and other short
// lists of written-out options. Use Pill for one-word options and Segmented to switch a view.
export function Choice({ label, selected, onPress, radio = false, disabled = false }: Props) {
  const t = useTheme();
  const markColor = selected ? t.color.accent : t.color.borderStrong;
  return (
    <Pressable
      accessibilityRole={radio ? "radio" : "checkbox"}
      accessibilityLabel={label}
      accessibilityState={radio ? { selected, disabled } : { checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? t.color.accentSoft : pressed ? t.color.surfacePressed : t.color.surface,
          // Same border width either way, so the label never shifts when selected.
          borderColor: selected ? t.color.accent : t.color.border,
        },
      ]}
    >
      <View
        style={[styles.mark, radio ? styles.round : styles.square, { borderColor: markColor, backgroundColor: selected && !radio ? t.color.accent : "transparent" }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {selected && radio ? <View style={[styles.dot, { backgroundColor: t.color.accent }]} /> : null}
        {selected && !radio ? <View style={[styles.tick, { borderColor: t.color.onAccent }]} /> : null}
      </View>
      <T style={styles.label}>{label}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: size.control,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + space.xs,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: borderWidth.thin,
  },
  mark: { width: size.mark, height: size.mark, borderWidth: borderWidth.thick, alignItems: "center", justifyContent: "center" },
  round: { borderRadius: radius.pill },
  square: { borderRadius: radius.sm - space.xxs },
  dot: { width: size.markDot, height: size.markDot, borderRadius: radius.pill },
  // A check drawn with two borders, rotated (no icon library yet).
  tick: {
    width: size.markDot,
    height: size.markDot / 2,
    borderLeftWidth: borderWidth.thick,
    borderBottomWidth: borderWidth.thick,
    transform: [{ translateY: -space.xxs / 2 }, { rotate: "-45deg" }],
  },
  label: { flex: 1 },
});

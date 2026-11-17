import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { borderWidth, minTouch, radius, size, space, state, type ColorRole } from "@/theme/tokens";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const badgeColors: Record<BadgeTone, { bg: ColorRole; fg: ColorRole }> = {
  neutral: { bg: "surfaceSunken", fg: "textMuted" },
  accent: { bg: "accentSoft", fg: "accent" },
  success: { bg: "successSoft", fg: "success" },
  warning: { bg: "warningSoft", fg: "warning" },
  danger: { bg: "dangerSoft", fg: "danger" },
};

type BadgeProps = {
  label: string;
  /** neutral (default): a fact. accent: "You", "Captain". success: "Verified". warning: "Pending". danger: "Rejected". */
  tone?: BadgeTone;
};

// A small, non-interactive status label. Keep it to one or two words.
export function Badge({ label, tone = "neutral" }: BadgeProps) {
  const t = useTheme();
  const colors = badgeColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.color[colors.bg] }]}>
      <Text style={[t.text("caption"), { color: t.color[colors.fg] }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

type PillProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

// A selectable chip, for picking one or several options from a short set (activity type, goal).
// Use Segmented instead for 2–4 options that switch a whole view.
export function Pill({ label, selected, onPress, disabled = false, accessibilityLabel }: PillProps) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      // The pill is drawn compact; the hit area extends it to the minimum touch size.
      hitSlop={(minTouch - size.controlCompact) / 2}
      style={({ pressed }) => [
        styles.pill,
        selected
          ? { backgroundColor: pressed ? t.color.accentPressed : t.color.accent, borderColor: "transparent" }
          : { backgroundColor: pressed ? t.color.surfacePressed : t.color.surface, borderColor: t.color.borderStrong },
        disabled && { opacity: state.disabledOpacity },
      ]}
    >
      <Text style={[t.text("label"), { color: selected ? t.color.onAccent : t.color.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.pill,
  },
  pill: {
    minHeight: size.controlCompact,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    alignItems: "center",
    justifyContent: "center",
  },
});

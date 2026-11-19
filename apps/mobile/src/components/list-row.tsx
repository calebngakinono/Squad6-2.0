import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { T } from "@/components/screen-text";
import { useTheme } from "@/theme/theme";
import { borderWidth, layout, size, space, state } from "@/theme/tokens";

type Props = {
  title: string;
  subtitle?: string;
  /** Left slot: a rank number, an avatar, a status dot. */
  leading?: ReactNode;
  /** Right slot for custom content. Use `value` for a plain number or short text. */
  trailing?: ReactNode;
  /** Short trailing text, set in tabular figures (points, distance, time). */
  value?: string;
  /** Makes the row tappable. */
  onPress?: () => void;
  /** Shows a chevron. Defaults to true when the row navigates (has onPress). */
  chevron?: boolean;
  /** Emphasizes the row (e.g. "you" or "your squad" in a ranking). */
  highlighted?: boolean;
  /** Draws a hairline under the row. Turn off for the last row of a group. Default true. */
  divider?: boolean;
  /**
   * Set by ListGroup: the row pads itself to the group's edges so its pressed state fills the whole
   * width, and the divider starts at the text like an iOS grouped list.
   */
  inset?: boolean;
  /** Caps the title at this many lines (long squad names in a ranking). Default: no limit. */
  titleLines?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

// One line in a list: settings, members, standings, history. Always at least 56pt tall and grows
// with larger text.
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  value,
  onPress,
  chevron = !!onPress,
  highlighted = false,
  divider = true,
  inset = false,
  titleLines,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const t = useTheme();
  const body = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.text}>
        <T variant={highlighted ? "button" : "body"} tone={highlighted ? "accent" : "text"} numberOfLines={titleLines}>
          {title}
        </T>
        {subtitle ? (
          <T variant="small" tone="textMuted">
            {subtitle}
          </T>
        ) : null}
      </View>
      {value ? (
        <T variant="label" tone={highlighted ? "accent" : "text"} numeric>
          {value}
        </T>
      ) : null}
      {trailing}
      {chevron ? (
        <View
          style={[styles.chevron, { borderColor: t.color.textMuted }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      {divider && inset ? (
        <View
          style={[styles.insetDivider, { backgroundColor: t.color.border }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
    </>
  );
  const rowStyle = [
    styles.row,
    inset && styles.inset,
    // Inside a group, a highlighted row ("your squad") is tinted as well as colored.
    inset && highlighted && { backgroundColor: t.color.accentSoft },
    divider && !inset && { borderBottomColor: t.color.border, borderBottomWidth: StyleSheet.hairlineWidth },
  ];
  const label = accessibilityLabel ?? [title, subtitle, value].filter(Boolean).join(", ");

  if (!onPress) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        rowStyle,
        pressed && { backgroundColor: t.color.surfacePressed },
        disabled && { opacity: state.disabledOpacity },
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: size.row,
    paddingVertical: space.sm + space.xs,
  },
  inset: { paddingHorizontal: layout.cardPadding },
  insetDivider: {
    position: "absolute",
    left: layout.cardPadding,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  leading: { minWidth: size.leading, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: space.xxs },
  chevron: {
    width: size.chevron,
    height: size.chevron,
    borderTopWidth: borderWidth.thick,
    borderRightWidth: borderWidth.thick,
    transform: [{ rotate: "45deg" }],
    marginRight: space.xs,
  },
});

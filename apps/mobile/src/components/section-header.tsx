import { Pressable, StyleSheet, View } from "react-native";
import { T } from "@/components/screen-text";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space, type } from "@/theme/tokens";

type Props = {
  title: string;
  /** One short line under the title. */
  subtitle?: string;
  /** A small text action on the right ("See all", "Edit"). */
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
  /**
   * section (default): a group heading inside a screen. screen: the title of a screen that has no
   * native header (home), with its action (e.g. "Settings") on the right.
   */
  level?: "section" | "screen";
};

// Heading for a group of content within a screen. Announced as a header to screen readers.
export function SectionHeader({ title, subtitle, action, level = "section" }: Props) {
  const t = useTheme();
  return (
    <View style={[styles.row, level === "screen" && styles.screenRow]}>
      <View style={styles.text}>
        {/* The home screen's title is the squad's sign: routed caps in sage. */}
        <T variant={level === "screen" ? "sign" : "headline"} tone={level === "screen" ? "accent" : "text"} accessibilityRole="header">
          {title}
        </T>
        {subtitle ? (
          <T variant={level === "screen" ? "body" : "small"} tone="textMuted">
            {subtitle}
          </T>
        ) : null}
      </View>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.action,
            level === "screen" && styles.screenAction,
            pressed && { backgroundColor: t.color.surfacePressed },
          ]}
        >
          <T variant="label" tone="accent">
            {action.label}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: space.md },
  // A screen title's action sits level with the title's first line, not its last.
  screenRow: { alignItems: "flex-start" },
  text: { flex: 1, gap: space.xxs },
  action: {
    minHeight: minTouch,
    minWidth: minTouch,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space.sm,
    // Pull the tap area outward so the text lines up with the screen edge.
    marginRight: -space.sm,
    marginBottom: -space.sm,
    borderRadius: radius.sm,
  },
  // Centers the 48pt tap area on the title's first line.
  screenAction: { marginBottom: 0, marginTop: -(minTouch - type.title.lineHeight) / 2 },
});

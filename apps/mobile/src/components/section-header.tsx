import { Pressable, StyleSheet, View } from "react-native";
import { T } from "@/components/screen-text";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";

type Props = {
  title: string;
  /** One short line under the title. */
  subtitle?: string;
  /** A small text action on the right ("See all", "Edit"). */
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
};

// Heading for a group of content within a screen. Announced as a header to screen readers.
export function SectionHeader({ title, subtitle, action }: Props) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <T variant="headline" accessibilityRole="header">
          {title}
        </T>
        {subtitle ? (
          <T variant="small" tone="textMuted">
            {subtitle}
          </T>
        ) : null}
      </View>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          onPress={action.onPress}
          style={({ pressed }) => [styles.action, pressed && { backgroundColor: t.color.surfacePressed }]}
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
});

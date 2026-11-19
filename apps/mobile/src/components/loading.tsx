import { ActivityIndicator, StyleSheet, View } from "react-native";
import { T } from "@/components/screen-text";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";

type Props = {
  /** What is loading, spoken by screen readers and shown under the spinner ("Loading standings"). */
  label: string;
  /** Fill the screen and center (a whole screen waiting) instead of a block in the flow. */
  fill?: boolean;
};

// The one loading look: a quiet spinner in the muted text color with a short line saying what is coming.
export function Loading({ label, fill = false }: Props) {
  const t = useTheme();
  return (
    <View style={[styles.wrap, fill && styles.fill]} accessible accessibilityLabel={label} accessibilityRole="progressbar">
      <ActivityIndicator color={t.color.textMuted} />
      <T variant="small" tone="textMuted" align="center">
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: space.sm, paddingVertical: space.xl },
  fill: { flex: 1, justifyContent: "center" },
});

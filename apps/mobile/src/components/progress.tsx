import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";

type Props = {
  /** Steps done so far, including the current one. */
  value: number;
  total: number;
  /** Spoken label, e.g. "Setup progress". */
  label: string;
};

// A thin bar showing where someone is in a short sequence of steps (onboarding). Only for counting
// steps in the app itself, never for fitness goals or anything the app would have to estimate.
export function Progress({ value, total, label }: Props) {
  const t = useTheme();
  const share = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: value, text: `Step ${value} of ${total}` }}
      style={[styles.track, { backgroundColor: t.color.surfaceSunken }]}
    >
      <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: t.color.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: space.xs, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill },
});

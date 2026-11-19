import { StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { T } from "@/components/screen-text";
import { useTheme } from "@/theme/theme";
import { radius, space, type ColorRole } from "@/theme/tokens";

export type NoticeTone = "danger" | "success" | "warning" | "info";

const tones: Record<NoticeTone, { bg: ColorRole; fg: "danger" | "success" | "warning" | "text" }> = {
  danger: { bg: "dangerSoft", fg: "danger" },
  success: { bg: "successSoft", fg: "success" },
  warning: { bg: "warningSoft", fg: "warning" },
  info: { bg: "surfaceSunken", fg: "text" },
};

type Props = {
  /** What happened and, for a problem, how to fix it. */
  message: string;
  /** danger: something failed. success: a change was saved. warning: works, with a caveat. info: neutral. */
  tone?: NoticeTone;
  /** One way to recover ("Try again", "Open Settings"). */
  action?: { label: string; onPress: () => void };
};

// An inline message placed next to the thing it is about (a failed load, a saved setting).
// Announced to screen readers when it appears.
export function Notice({ message, tone = "danger", action }: Props) {
  const t = useTheme();
  const look = tones[tone];
  return (
    <View style={[styles.wrap, { backgroundColor: t.color[look.bg] }]}>
      <T variant="small" tone={look.fg} accessibilityLiveRegion="polite" accessibilityRole={tone === "danger" ? "alert" : undefined}>
        {message}
      </T>
      {action ? <Button label={action.label} variant="secondary" onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.md, borderCurve: "continuous", paddingHorizontal: space.md, paddingVertical: space.sm + space.xs, gap: space.sm + space.xs },
});

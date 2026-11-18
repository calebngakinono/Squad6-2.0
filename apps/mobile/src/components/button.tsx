import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { borderWidth, radius, size, space, state, type ColorRole } from "@/theme/tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

type Props = {
  label: string;
  onPress: () => void;
  /**
   * primary: the one main action on a screen. secondary: other actions. ghost: low-emphasis actions
   * (inline "Change", "Skip"). destructive: removes or ends something (leave squad, discard workout).
   */
  variant?: ButtonVariant;
  /** Shows a spinner and blocks taps while an action runs. */
  busy?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

type Look = { bg: ColorRole | null; pressedBg: ColorRole | null; fg: ColorRole; outline: boolean };

const looks: Record<ButtonVariant, Look> = {
  primary: { bg: "accent", pressedBg: "accentPressed", fg: "onAccent", outline: false },
  secondary: { bg: "surface", pressedBg: "surfacePressed", fg: "text", outline: true },
  ghost: { bg: null, pressedBg: "surfacePressed", fg: "accent", outline: false },
  destructive: { bg: "danger", pressedBg: "dangerPressed", fg: "onDanger", outline: false },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: Props) {
  const t = useTheme();
  const look = looks[variant];
  const inactive = disabled || busy;
  const fg = t.color[look.fg];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed && look.pressedBg ? t.color[look.pressedBg] : look.bg ? t.color[look.bg] : "transparent",
          borderColor: t.color.border,
          borderWidth: look.outline ? borderWidth.thin : 0,
          opacity: disabled && !busy ? state.disabledOpacity : 1,
          transform: [{ scale: pressed ? state.pressedScale : 1 }],
        },
      ]}
    >
      {/* The label stays in the layout while busy so the button does not change size. */}
      <Text style={[t.text("button"), styles.label, { color: fg }, busy && styles.hidden]}>{label}</Text>
      {busy && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.spinner}>
            <ActivityIndicator color={fg} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: size.control,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderCurve: "continuous",
  },
  label: { textAlign: "center" },
  hidden: { opacity: 0 },
  spinner: { flex: 1, alignItems: "center", justifyContent: "center" },
});

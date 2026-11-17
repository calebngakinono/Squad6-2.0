import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { minTouch, radius, space, type } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  busy?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = "primary", busy = false, disabled = false }: Props) {
  const c = usePalette();
  const primary = variant === "primary";
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary
          ? { backgroundColor: c.accent }
          : { backgroundColor: "transparent", borderColor: c.border, borderWidth: 1 },
        { opacity: inactive ? 0.55 : pressed ? 0.8 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? c.onAccent : c.text} />
      ) : (
        <Text style={[type.label, { color: primary ? c.onAccent : c.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouch + 4,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
  },
});

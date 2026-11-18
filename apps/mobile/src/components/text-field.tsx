import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "@/theme/theme";
import { borderWidth, radius, size, space } from "@/theme/tokens";

type Props = TextInputProps & {
  label: string;
  /** Guidance shown under the field (format, limits). Replaced by `error` when there is one. */
  helper?: string;
  /** What is wrong and how to fix it. Turns the field red and is announced to screen readers. */
  error?: string | null;
};

export function TextField({ label, helper, error, onFocus, onBlur, editable = true, style, ...input }: Props) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const message = error || helper;
  const outline = error ? t.color.danger : focused ? t.color.focus : t.color.borderStrong;
  // A thicker border while focused or in error; padding shrinks by the same amount so text never shifts.
  const thick = focused || !!error;
  return (
    <View style={styles.wrap}>
      <Text style={[t.text("label"), { color: t.color.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={message || undefined}
        accessibilityState={{ disabled: !editable }}
        editable={editable}
        placeholderTextColor={t.color.textMuted}
        selectionColor={t.color.accent}
        cursorColor={t.color.accent}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          // iOS draws single-line input text off-center when a lineHeight is set.
          input.multiline ? t.text("body") : { ...t.text("body"), lineHeight: undefined },
          styles.input,
          {
            color: t.color.text,
            backgroundColor: editable ? t.color.surface : t.color.surfaceSunken,
            borderColor: outline,
            borderWidth: thick ? borderWidth.thick : borderWidth.thin,
            paddingHorizontal: space.md - (thick ? borderWidth.thick - borderWidth.thin : 0),
          },
          style,
        ]}
        {...input}
      />
      {message ? (
        <Text
          style={[t.text("small"), { color: error ? t.color.danger : t.color.textMuted }]}
          accessibilityLiveRegion={error ? "polite" : "none"}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  input: {
    minHeight: size.control,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingVertical: space.sm + space.xs,
  },
});

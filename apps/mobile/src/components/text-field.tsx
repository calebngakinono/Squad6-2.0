import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { minTouch, radius, space, type } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

export function TextField({ label, ...input }: TextInputProps & { label: string }) {
  const c = usePalette();
  return (
    <View style={styles.wrap}>
      <Text style={[type.label, { color: c.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textMuted}
        style={[
          type.body,
          styles.input,
          { color: c.text, backgroundColor: c.surface, borderColor: c.border },
        ]}
        {...input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  input: { minHeight: minTouch + 4, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
});

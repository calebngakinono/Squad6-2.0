import { Pressable, StyleSheet, View } from "react-native";
import { T } from "@/components/screen-text";
import { minTouch, radius, space } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

type Props<V extends string | number> = {
  label: string;
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
};

// A row of mutually exclusive choices (tabs, filters). Each option is a full-height tap target.
export function Segmented<V extends string | number>({ label, options, value, onChange }: Props<V>) {
  const c = usePalette();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.row, { borderColor: c.border }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [styles.option, { backgroundColor: selected ? c.accent : "transparent", opacity: pressed ? 0.8 : 1 }]}
          >
            <T variant="label" style={{ color: selected ? c.onAccent : c.text }} numberOfLines={1}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", borderWidth: 1, borderRadius: radius.md, overflow: "hidden" },
  option: { flex: 1, minHeight: minTouch, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm },
});

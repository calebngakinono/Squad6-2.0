import { Pressable, StyleSheet, View } from "react-native";
import { T } from "@/components/screen-text";
import { elevationStyle, useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";

type Props<V extends string | number> = {
  label: string;
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
};

// A row of 2–4 mutually exclusive choices (tabs, filters). Each option is a full-height tap target.
// The selected option is a raised thumb on a sunken track, like the iOS segmented control.
export function Segmented<V extends string | number>({ label, options, value, onChange }: Props<V>) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[styles.track, { backgroundColor: t.color.surfaceSunken }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            hitSlop={{ top: PAD, bottom: PAD }}
            style={({ pressed }) => [
              styles.option,
              selected
                ? { backgroundColor: t.color.surfaceRaised, ...elevationStyle(t.elevation.thumb, t.color) }
                : pressed && { backgroundColor: t.color.surfacePressed },
            ]}
          >
            <T variant="label" tone={selected ? "text" : "textMuted"} numberOfLines={1}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const PAD = space.xxs + space.xxs;

const styles = StyleSheet.create({
  track: { flexDirection: "row", borderRadius: radius.md, borderCurve: "continuous", padding: PAD, gap: PAD },
  option: {
    flex: 1,
    // With the track padding (and hitSlop) each option is a full minTouch tall.
    minHeight: minTouch - PAD * 2,
    borderRadius: radius.md - PAD,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
});

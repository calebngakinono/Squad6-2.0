import { View, type ViewProps } from "react-native";
import { radius, space } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

export function Card({ style, ...rest }: ViewProps) {
  const c = usePalette();
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.md },
        style,
      ]}
      {...rest}
    />
  );
}

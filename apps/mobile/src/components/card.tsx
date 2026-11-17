import { View, type ViewProps } from "react-native";
import { elevationStyle, useTheme } from "@/theme/theme";
import { borderWidth, layout, radius } from "@/theme/tokens";

type Props = ViewProps & {
  /**
   * raised (default): a surface lifted off the background (soft shadow in light mode, hairline in dark).
   * outlined: flat with a hairline, for content that sits inside a raised area or many cards in a row.
   * sunken: a recessed well for secondary information (notes, sources).
   */
  variant?: "raised" | "outlined" | "sunken";
};

// A grouped block of related content. Do not put a Card inside a Card.
export function Card({ variant = "raised", style, ...rest }: Props) {
  const t = useTheme();
  const look =
    variant === "raised"
      ? { backgroundColor: t.color.surface, ...elevationStyle(t.elevation.raised, t.color) }
      : variant === "outlined"
        ? { backgroundColor: t.color.surface, borderWidth: borderWidth.thin, borderColor: t.color.border }
        : { backgroundColor: t.color.surfaceSunken };
  return (
    <View
      style={[
        { borderRadius: radius.lg, borderCurve: "continuous", padding: layout.cardPadding, gap: layout.stackGap },
        look,
        style,
      ]}
      {...rest}
    />
  );
}

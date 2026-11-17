import { Text, type TextProps } from "react-native";
import { type as typeScale } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

type Variant = keyof typeof typeScale;
type Tone = "text" | "textMuted" | "danger" | "accent";

// Text that always uses the token scale and palette, so screens never hard-code type or color.
export function T({ variant = "body", tone = "text", style, ...rest }: TextProps & { variant?: Variant; tone?: Tone }) {
  const c = usePalette();
  return <Text style={[typeScale[variant], { color: c[tone] }, style]} {...rest} />;
}

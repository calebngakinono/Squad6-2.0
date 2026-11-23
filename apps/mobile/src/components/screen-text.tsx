import { Text, type TextProps } from "react-native";
import { useTheme } from "@/theme/theme";
import type { ColorRole, TypeVariant } from "@/theme/tokens";

export type TextTone = "text" | "textMuted" | "accent" | "success" | "warning" | "danger" | "onAccent";

type Props = TextProps & {
  /** Size and weight from the type scale. Default `body`. */
  variant?: TypeVariant;
  /** Color role. Default `text`. */
  tone?: TextTone;
  /** Tabular figures, so changing digits keep their width (timers, scores, ranks). */
  numeric?: boolean;
  align?: "left" | "center" | "right";
};

const toneRole: Record<TextTone, ColorRole> = {
  text: "text",
  textMuted: "textMuted",
  accent: "accent",
  success: "success",
  warning: "warning",
  danger: "danger",
  onAccent: "onAccent",
};

/**
 * How far the already-large variants grow with the iOS text size. They start at 32–76pt, so letting
 * them triple would push a timer or a score off the screen; reading text (body, label, small…) is never
 * capped. A screen can still pass its own maxFontSizeMultiplier.
 */
const MAX_SCALE: Partial<Record<TypeVariant, number>> = { timer: 1.3, display: 1.4, sign: 1.5, title: 1.5 };

// Text that always uses the token scale and palette, so screens never hard-code type or color.
export function T({ variant = "body", tone = "text", numeric = false, align, style, maxFontSizeMultiplier, ...rest }: Props) {
  const t = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MAX_SCALE[variant]}
      style={[
        t.text(variant),
        { color: t.color[toneRole[tone]] },
        numeric && { fontVariant: ["tabular-nums"] },
        align && { textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
}

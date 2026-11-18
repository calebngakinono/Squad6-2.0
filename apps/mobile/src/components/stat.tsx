import { StyleSheet, View } from "react-native";
import { T } from "@/components/screen-text";
import { space } from "@/theme/tokens";

type Props = {
  /** The number, already formatted ("5.24", "1,280", "12:04"). */
  value: string;
  /** What it is ("Distance", "Season points"). */
  label: string;
  /** Unit after the number, smaller ("km", "/km", "pts"). */
  unit?: string;
  /**
   * Where the number came from ("Phone GPS", "Apple Health", "Calculated by Squad Six"). Required by
   * the data-integrity rules for any fitness metric; optional only for non-fitness numbers like rank.
   */
  source?: string;
  /** `large` for the one hero number on a screen; `regular` for a row of stats. */
  size?: "regular" | "large";
  align?: "left" | "center";
  /** Overrides the spoken text (defaults to "label, value unit, source"). */
  accessibilityLabel?: string;
};

// A number that matters, with its label and where it came from. Numbers use tabular figures.
export function Stat({ value, label, unit, source, size = "regular", align = "left", accessibilityLabel }: Props) {
  const center = align === "center";
  return (
    <View
      style={[styles.wrap, center && styles.center]}
      accessible
      accessibilityLabel={accessibilityLabel ?? [label, unit ? `${value} ${unit}` : value, source].filter(Boolean).join(", ")}
    >
      <View style={[styles.figure, center && styles.figureCenter]}>
        <T variant={size === "large" ? "display" : "metric"} numeric>
          {value}
        </T>
        {unit ? (
          <T variant={size === "large" ? "headline" : "label"} tone="textMuted">
            {unit}
          </T>
        ) : null}
      </View>
      <T variant="small" tone="textMuted" align={align}>
        {label}
      </T>
      {source ? (
        <T variant="caption" tone="textMuted" align={align}>
          {source}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xxs },
  center: { alignItems: "center" },
  figure: { flexDirection: "row", alignItems: "baseline", gap: space.xs, flexWrap: "wrap" },
  figureCenter: { justifyContent: "center" },
});

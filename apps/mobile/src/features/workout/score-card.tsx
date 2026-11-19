import type { WorkoutScore } from "@squad-six/shared";
import { StyleSheet, View } from "react-native";
import { Card } from "@/components/card";
import { T } from "@/components/screen-text";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { summarizeScore } from "./score-summary";

type Props = {
  score: WorkoutScore;
  /** A closing line about where the number came from or whether it can still change. */
  footnote?: string;
};

// How the server scored one workout: the total, the lines that add up to it, and plain-language
// notes. Display only: every number is the server's (summarizeScore formats, never calculates).
export function ScoreCard({ score, footnote }: Props) {
  const t = useTheme();
  const summary = summarizeScore(score);
  const earned = score.status === "accepted";
  return (
    <Card>
      <View style={styles.head}>
        <T variant="label" tone="textMuted">
          Workout score
        </T>
        <T variant={earned ? "display" : "headline"} numeric accessibilityRole="header">
          {summary.headline}
        </T>
      </View>
      {summary.lines.length > 0 && (
        <View style={[styles.lines, { borderTopColor: t.color.border }]}>
          {summary.lines.map((line) => (
            <View key={line.label} style={styles.line} accessible accessibilityLabel={`${line.label}: ${line.value}`}>
              <T tone="textMuted" style={styles.grow}>
                {line.label}
              </T>
              <T variant="label" numeric>
                {line.value}
              </T>
            </View>
          ))}
        </View>
      )}
      {summary.notes.map((note) => (
        <T key={note} variant="small" tone="textMuted">
          {note}
        </T>
      ))}
      {footnote ? (
        <T variant="caption" tone="textMuted">
          {footnote}
        </T>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xxs },
  lines: { gap: space.sm + space.xs, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  line: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
  grow: { flexShrink: 1 },
});

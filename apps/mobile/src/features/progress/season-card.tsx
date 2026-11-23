import { nextMilestone, SEP, weeksReached, type Progress } from "@squad-six/shared";
import { StyleSheet, View } from "react-native";
import { Card } from "@/components/card";
import { T } from "@/components/screen-text";
import { Stat } from "@/components/stat";
import { Blazes } from "@/features/goals/week-strip";
import { formatPoints } from "@/features/standings/view";
import { space } from "@/theme/tokens";

type Props = { progress: Progress; season: number };

// The person's own season, squad or no squad: counted points, every workout they finished, their goal
// streak, the last 12 weeks as blazes, and the next milestone. Counts only; nothing here earns points.
export function SeasonCard({ progress: p, season }: Props) {
  const reached = weeksReached(p);
  const next = nextMilestone(p);
  const streak = `${p.goal_streak} ${p.goal_streak === 1 ? "week" : "weeks"}`;

  return (
    <Card>
      <T variant="headline" accessibilityRole="header">
        {`Your ${season} season`}
      </T>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Stat value={formatPoints(p.season_points)} label="Points" source="Squad Six scoring" />
        </View>
        <View style={styles.stat}>
          <Stat value={String(p.season_workouts)} label="Workouts" source="Verified or not" />
        </View>
        {p.weekly_goal !== null && (
          <View style={styles.stat}>
            <Stat value={String(p.goal_streak)} label="Goal streak" unit={p.goal_streak === 1 ? "week" : "weeks"} source="Weeks in a row" />
          </View>
        )}
      </View>

      {p.weekly_goal !== null ? (
        <View
          style={styles.history}
          accessible
          accessibilityLabel={`Weekly goal reached in ${reached} of the last ${p.weeks.length} weeks. Goal streak ${streak}.`}
        >
          {/* One blaze per week, oldest on the left: painted when the goal was reached. */}
          <Blazes marks={p.weeks.map((w) => w.days >= p.weekly_goal!)} bright />
          <T variant="small" tone="textMuted">
            {`Goal reached in ${reached} of the last ${p.weeks.length} weeks`}
          </T>
        </View>
      ) : (
        <T variant="small" tone="textMuted">
          Set a weekly goal in Settings to track your streak.
        </T>
      )}

      {next ? (
        <T variant="label">{`Next: ${next.label}${SEP}${next.remaining} to go`}</T>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
  stat: { minWidth: space.xxl * 1.6, flexGrow: 1 },
  history: { gap: space.xs },
});

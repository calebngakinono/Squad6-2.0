import type { WorkoutMetric, WorkoutScore } from "@squad-six/shared";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { Stat } from "@/components/stat";
import { loadMyWorkout } from "@/features/history/api";
import { activityLabel, dayLabel } from "@/features/history/view";
import { formatDuration } from "@/features/workout/machine";
import { summarizeScore } from "@/features/workout/score-summary";
import { formatDistance, usesMiles } from "@/features/workout/tracking/track";
import { fetchWorkoutMetrics, fetchWorkoutScore } from "@/features/workout/transport";
import { space } from "@/theme/tokens";

type Loaded = {
  workout: NonNullable<Awaited<ReturnType<typeof loadMyWorkout>>>;
  score: WorkoutScore | null;
  metrics: WorkoutMetric[];
};

// One past workout: what was measured (with its source) and how the server scored it.
export default function PastWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const workout = await loadMyWorkout(id);
        if (!workout) throw new Error("not found");
        const [score, metrics] = await Promise.all([fetchWorkoutScore(id), fetchWorkoutMetrics(id)]);
        if (!cancelled) setLoaded({ workout, score, metrics });
      } catch {
        if (!cancelled) setError("Couldn't load this workout.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const miles = usesMiles(Intl.DateTimeFormat().resolvedOptions().locale);
  const metric = (name: WorkoutMetric["metric"], sources: WorkoutMetric["source"][]) =>
    loaded?.metrics.find((m) => m.metric === name && sources.includes(m.source));
  const distance = metric("distance_m", ["gps"]);
  const watchDistance = metric("distance_m", ["healthkit", "health_connect"]);
  const steps = metric("steps", ["pedometer"]);
  const heartRate = metric("avg_heart_rate", ["healthkit", "health_connect"]);
  const summary = loaded?.score ? summarizeScore(loaded.score) : null;

  return (
    <Screen header>
      <Stack.Screen options={{ headerShown: true, title: loaded ? activityLabel(loaded.workout.activity) : "Workout" }} />
      {error && <T tone="danger">{error}</T>}
      {!loaded && !error && <ActivityIndicator accessibilityLabel="Loading workout" />}
      {loaded && (
        <>
          <T tone="textMuted">{dayLabel(loaded.workout.local_date, new Date())}</T>
          <View style={styles.stats}>
            <Stat value={formatDuration(loaded.workout.active_seconds ?? 0)} label="Active time" source="Squad Six timer" />
            {distance && <Stat value={formatDistance(distance.value, miles)} label="Distance" source="Phone GPS" />}
            {!distance && watchDistance && <Stat value={formatDistance(watchDistance.value, miles)} label="Distance" source="Synced from Apple Health" />}
            {steps && <Stat value={steps.value.toLocaleString("en-US")} label="Steps" source="Phone step counter" />}
            {heartRate && <Stat value={`${Math.round(heartRate.value)}`} unit="bpm" label="Average heart rate" source="Synced from Apple Health" />}
          </View>

          {summary ? (
            <Card>
              <T variant="headline" accessibilityRole="header">
                {summary.headline}
              </T>
              {summary.lines.map((line) => (
                <View key={line.label} style={styles.line} accessible accessibilityLabel={`${line.label}: ${line.value}`}>
                  <T tone="textMuted" style={styles.grow}>
                    {line.label}
                  </T>
                  <T numeric>{line.value}</T>
                </View>
              ))}
              {summary.notes.map((note) => (
                <T key={note} variant="small" tone="textMuted">
                  {note}
                </T>
              ))}
            </Card>
          ) : (
            <T variant="small" tone="textMuted">
              {loaded.workout.state === "expired"
                ? "This workout was left running for more than 12 hours, so it was closed and not scored."
                : "Not scored. Points are calculated by the server once scoring is switched on."}
            </T>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { gap: space.lg },
  line: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  grow: { flexShrink: 1 },
});

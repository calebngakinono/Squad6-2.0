import type { WorkoutMetric, WorkoutScore } from "@squad-six/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/card";
import { Grid, GridCell } from "@/components/grid";
import { Loading } from "@/components/loading";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { splitUnit, Stat } from "@/components/stat";
import { loadMyWorkout } from "@/features/history/api";
import { activityLabel, dayLabel } from "@/features/history/view";
import { formatDuration } from "@/features/workout/machine";
import { ScoreCard } from "@/features/workout/score-card";
import { formatDistance, usesMiles } from "@/features/workout/tracking/track";
import { fetchWorkoutMetrics, fetchWorkoutScore } from "@/features/workout/transport";

type Loaded = {
  workout: NonNullable<Awaited<ReturnType<typeof loadMyWorkout>>>;
  score: WorkoutScore | null;
  metrics: WorkoutMetric[];
};

// One past workout: how the server scored it, then what was measured (each with its source).
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
        if (!cancelled) setError("Couldn't load this workout. Check your connection and open it again.");
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
  const shownDistance = distance
    ? { ...splitUnit(formatDistance(distance.value, miles)), source: "Phone GPS" }
    : watchDistance
      ? { ...splitUnit(formatDistance(watchDistance.value, miles)), source: "Synced from Apple Health" }
      : null;

  return (
    <Screen header>
      <Stack.Screen options={{ headerShown: true, title: loaded ? activityLabel(loaded.workout.activity) : "Workout" }} />
      {error && <Notice message={error} action={{ label: "Back", onPress: () => router.back() }} />}
      {!loaded && !error && <Loading label="Loading workout" />}
      {loaded && (
        <>
          <T variant="title" accessibilityRole="header">
            {dayLabel(loaded.workout.local_date, new Date())}
          </T>

          {loaded.score ? (
            <ScoreCard score={loaded.score} />
          ) : (
            <Card variant="sunken">
              <T tone="textMuted">
                {loaded.workout.state === "expired"
                  ? "This workout was left running for more than 12 hours, so it was closed and not scored."
                  : "Not scored yet. Points show here once it's scored."}
              </T>
            </Card>
          )}

          <Card>
            <Grid gap="lg">
              <GridCell>
                <Stat value={formatDuration(loaded.workout.active_seconds ?? 0)} label="Active time" source="Squad Six timer" />
              </GridCell>
              {shownDistance && (
                <GridCell>
                  <Stat value={shownDistance.value} unit={shownDistance.unit} label="Distance" source={shownDistance.source} />
                </GridCell>
              )}
              {steps && (
                <GridCell>
                  <Stat value={steps.value.toLocaleString("en-US")} label="Steps" source="Phone step counter" />
                </GridCell>
              )}
              {heartRate && (
                <GridCell>
                  <Stat value={`${Math.round(heartRate.value)}`} unit="bpm" label="Average heart rate" source="Synced from Apple Health" />
                </GridCell>
              )}
            </Grid>
          </Card>
        </>
      )}
    </Screen>
  );
}

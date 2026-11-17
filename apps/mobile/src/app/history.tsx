import type { MyWorkout } from "@squad-six/shared";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, View } from "react-native";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { loadMyWorkouts } from "@/features/history/api";
import { activityLabel, dayLabel, outcomeLabel } from "@/features/history/view";
import { formatDuration } from "@/features/workout/machine";

// My past workouts, newest first. Tap one for its breakdown.
export default function HistoryScreen() {
  const [workouts, setWorkouts] = useState<MyWorkout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setWorkouts(await loadMyWorkouts());
      setError(null);
    } catch {
      setError("Couldn't load your workouts. Pull down to try again.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const today = new Date();

  return (
    <Screen
      header
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <Stack.Screen options={{ headerShown: true, title: "My workouts" }} />
      {error && <T tone="danger">{error}</T>}
      {workouts === null && !error && <ActivityIndicator accessibilityLabel="Loading workouts" />}
      {workouts?.length === 0 && (
        <EmptyState
          title="No workouts yet"
          message="Your finished workouts and the points they earned will show up here."
          action={{ label: "Start a workout", onPress: () => router.push("/start-workout") }}
        />
      )}
      {workouts && workouts.length > 0 && (
        <View>
          {workouts.map((w, i) => (
            <ListRow
              key={w.id}
              title={activityLabel(w.activity)}
              subtitle={`${dayLabel(w.local_date, today)} · ${formatDuration(w.active_seconds ?? 0)}`}
              value={outcomeLabel(w.state === "expired" ? "expired" : w.workout_scores?.status, w.workout_scores?.total ?? 0)}
              chevron
              divider={i < workouts.length - 1}
              onPress={() => router.push({ pathname: "/past-workout/[id]", params: { id: w.id } })}
            />
          ))}
        </View>
      )}
      {workouts && workouts.length >= 100 && (
        <T variant="small" tone="textMuted">
          Showing your latest 100 workouts.
        </T>
      )}
      {workouts?.length === 0 ? null : <Button label="Start a workout" variant="secondary" onPress={() => router.push("/start-workout")} />}
    </Screen>
  );
}

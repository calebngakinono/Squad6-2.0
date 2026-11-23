import { SEP } from "@squad-six/shared";
import type { MyWorkout } from "@squad-six/shared";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, StyleSheet } from "react-native";
import { EmptyState } from "@/components/empty-state";
import { ListGroup } from "@/components/list-group";
import { ListRow } from "@/components/list-row";
import { Loading } from "@/components/loading";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { loadMyWorkouts } from "@/features/history/api";
import { activityLabel, dayLabel, outcomeLabel } from "@/features/history/view";
import { formatDuration } from "@/features/workout/machine";
import { minTouch, space, state } from "@/theme/tokens";

// The Me tab: my past workouts, newest first (tap one for its breakdown), and Settings in the header.
export default function MeScreen() {
  const [workouts, setWorkouts] = useState<MyWorkout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setWorkouts(await loadMyWorkouts());
      setError(null);
    } catch {
      setError("Couldn't load your workouts. Check your connection, then try again.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const today = new Date();
  const hasWorkouts = !!workouts && workouts.length > 0;

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
      <Stack.Screen options={{ headerShown: true, title: "My workouts", headerRight: () => <SettingsButton /> }} />
      {error && <Notice message={error} action={{ label: "Try again", onPress: () => void load() }} />}
      {workouts === null && !error && <Loading label="Loading workouts" />}
      {workouts?.length === 0 && (
        <EmptyState
          title="No workouts yet"
          message="Your finished workouts and the points they earned will show up here."
          action={{ label: "Start a workout", onPress: () => router.push("/start-workout") }}
        />
      )}
      {workouts && hasWorkouts && (
        <ListGroup>
          {workouts.map((w) => (
            <ListRow
              key={w.id}
              title={activityLabel(w.activity)}
              subtitle={`${dayLabel(w.local_date, today)}${SEP}${formatDuration(w.active_seconds ?? 0)}`}
              value={outcomeLabel(w.state === "expired" ? "expired" : w.workout_scores?.status, w.workout_scores?.total ?? 0)}
              chevron
              onPress={() => router.push({ pathname: "/past-workout/[id]", params: { id: w.id } })}
            />
          ))}
        </ListGroup>
      )}
      {__DEV__ && (
        <ListGroup>
          <ListRow title="Device check" subtitle="Development builds only" onPress={() => router.push("/device-check")} />
        </ListGroup>
      )}
      {workouts && workouts.length >= 100 && (
        <T variant="small" tone="textMuted" align="center">
          Showing your latest 100 workouts.
        </T>
      )}
    </Screen>
  );
}

// iOS 26 and later already draws a glass button around header items, so this is the label alone.
function SettingsButton() {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push("/settings")}
      hitSlop={space.sm}
      style={({ pressed }) => [styles.headerButton, pressed && { opacity: state.pressedOpacity }]}
    >
      <T variant="label" tone="accent">
        Settings
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerButton: { minHeight: minTouch, justifyContent: "center" },
});

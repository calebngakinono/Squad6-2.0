import { router, Stack } from "expo-router";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { T } from "@/components/screen-text";
import { activityInfo, formatDuration, stateOf } from "@/features/workout/machine";
import { SetLogger } from "@/features/workout/set-logger";
import { clearFinishedWorkout, liveSeconds, transitionWorkout } from "@/features/workout/store";
import { useNow, useWorkout } from "@/features/workout/use-workout";
import { space } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

export default function WorkoutScreen() {
  const c = usePalette();
  const { workout, server, pending, syncing, notice } = useWorkout();
  const state = workout ? stateOf(workout.events) : null;
  const now = useNow(state === "active");

  if (!workout || !state) {
    return (
      <SafeAreaView style={[styles.screen, styles.center, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ headerShown: true, title: "Workout" }} />
        <T tone="textMuted">No workout in progress.</T>
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const info = activityInfo(workout.activity);
  const open = state === "active" || state === "paused";
  const synced = pending === 0;
  // After finishing, show the server's official active time once it has it.
  const seconds = !open && synced && server?.active_seconds != null ? server.active_seconds : liveSeconds(workout, now);

  const syncLabel = synced
    ? "Saved"
    : syncing
      ? "Saving…"
      : `${pending} change${pending === 1 ? "" : "s"} saved on this phone, will sync when online`;

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.screen, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: true, title: info.label, headerBackVisible: !open, gestureEnabled: !open }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.timer}>
          <T variant="small" tone="textMuted">
            {state === "active" ? "Active time" : state === "paused" ? "Paused" : state === "finished" ? "Finished" : "Discarded"}
          </T>
          <T
            style={styles.clock}
            accessibilityRole="timer"
            accessibilityLabel={`Active time ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds`}
          >
            {formatDuration(seconds)}
          </T>
          <T variant="small" tone={synced ? "textMuted" : "accent"} accessibilityLiveRegion="polite">
            {syncLabel}
          </T>
          {notice && (
            <T variant="small" tone="danger" accessibilityLiveRegion="polite">
              {notice}
            </T>
          )}
        </View>

        {info.sets && <SetLogger sets={workout.sets} editable={open} />}

        {info.gps && open && (
          <T variant="small" tone="textMuted">
            GPS tracking arrives in the next update. For now this records time only.
          </T>
        )}

        {!open && state === "finished" && (
          <Card>
            <T variant="label">Workout submitted</T>
            <T tone="textMuted">
              {synced
                ? "Points are calculated by the server once scoring launches. Nothing is estimated on your phone."
                : "It will be submitted as soon as you're back online."}
            </T>
          </Card>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {state === "active" && <Button label="Pause" variant="secondary" onPress={() => transitionWorkout("pause")} />}
        {state === "paused" && <Button label="Resume" onPress={() => transitionWorkout("resume")} />}
        {open && (
          <Button
            label="Finish"
            onPress={() =>
              Alert.alert("Finish this workout?", `Active time ${formatDuration(seconds)}.`, [
                { text: "Keep going", style: "cancel" },
                { text: "Finish", onPress: () => transitionWorkout("finish") },
              ])
            }
          />
        )}
        {open && (
          <Button
            label="Discard"
            variant="secondary"
            onPress={() =>
              Alert.alert("Discard this workout?", "It won't count. This can't be undone.", [
                { text: "Keep", style: "cancel" },
                { text: "Discard", style: "destructive", onPress: () => transitionWorkout("cancel") },
              ])
            }
          />
        )}
        {!open && (
          <Button
            label="Done"
            disabled={!synced}
            onPress={() => {
              clearFinishedWorkout();
              router.dismissTo("/");
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: space.md },
  content: { padding: space.lg, gap: space.lg },
  timer: { alignItems: "center", gap: space.xs, paddingVertical: space.lg },
  clock: { fontSize: 64, lineHeight: 72, fontWeight: "700", fontVariant: ["tabular-nums"] },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm },
});

import { router, Stack } from "expo-router";
import { Alert, Linking, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { T } from "@/components/screen-text";
import { activityInfo, formatDuration, stateOf } from "@/features/workout/machine";
import { SetLogger } from "@/features/workout/set-logger";
import { clearFinishedWorkout, liveSeconds, transitionWorkout } from "@/features/workout/store";
import { formatDistance, formatPace, formatSpeed, usesMiles } from "@/features/workout/tracking/track";
import { useNow, useWorkout } from "@/features/workout/use-workout";
import { space } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

export default function WorkoutScreen() {
  const c = usePalette();
  const { workout, server, pending, syncing, notice, tracking } = useWorkout();
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
  const synced = pending === 0 && !tracking.pending;
  // After finishing, show the server's official active time once it has it.
  const seconds = !open && synced && server?.active_seconds != null ? server.active_seconds : liveSeconds(workout, now);

  const syncLabel = synced
    ? "Saved"
    : syncing
      ? "Saving…"
      : pending > 0
        ? `${pending} change${pending === 1 ? "" : "s"} saved on this phone, will sync when online`
        : open
          ? "Saved"
          : "Measurements saved on this phone, will upload when online";

  // Official numbers come from the server after the finish; until then, what this phone measured.
  const official = Object.fromEntries((tracking.metrics ?? []).map((m) => [m.metric, m.value]));
  const confirmed = tracking.metrics !== null;
  const distance = official.distance_m ?? tracking.distanceM;
  const steps = official.steps ?? tracking.steps;
  const miles = usesMiles(Intl.DateTimeFormat().resolvedOptions().locale);
  const rate = distance == null ? null : workout.activity === "cycle" ? formatSpeed(distance, seconds, miles) : formatPace(distance, seconds, miles);
  const stats = [
    distance != null && { label: "Distance", value: formatDistance(distance, miles) },
    rate != null && { label: workout.activity === "cycle" ? "Average speed" : "Average pace", value: rate },
    steps != null && { label: "Steps", value: steps.toLocaleString() },
  ].filter((x) => x !== false);
  const sources = [distance != null && "phone GPS", steps != null && "phone step counter"].filter((x) => x !== false).join(" and ");

  const gpsNote = !info.gps || !open
    ? null
    : tracking.gps === "denied"
      ? "Location is turned off for Squad Six, so this workout is recording time only."
      : tracking.gps === "unavailable"
        ? "Location isn't available on this phone right now. This workout is recording time only."
        : tracking.gps === "on" && tracking.distanceM === 0 && state === "active"
          ? "Distance starts once you are moving and the GPS signal is good."
          : state === "paused"
            ? "Location is off while the workout is paused."
            : null;

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

        {stats.length > 0 && (
          <View style={styles.statsBlock}>
            <View style={styles.stats}>
              {stats.map((s) => (
                <View key={s.label} style={styles.stat} accessible accessibilityLabel={`${s.label} ${s.value}`}>
                  <T variant="metric" style={styles.statValue}>
                    {s.value}
                  </T>
                  <T variant="small" tone="textMuted">
                    {s.label}
                  </T>
                </View>
              ))}
            </View>
            <T variant="small" tone="textMuted" style={styles.statSource}>
              {confirmed ? `Measured by your ${sources}, calculated by Squad Six.` : `Live from your ${sources}.`}
            </T>
          </View>
        )}

        {gpsNote && (
          <View style={styles.note}>
            <T variant="small" tone="textMuted" accessibilityLiveRegion="polite">
              {gpsNote}
            </T>
            {tracking.gps === "denied" && (
              <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} />
            )}
          </View>
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
  statsBlock: { gap: space.sm },
  stats: { flexDirection: "row", justifyContent: "space-around", gap: space.md },
  stat: { alignItems: "center", gap: space.xs, flexShrink: 1 },
  statValue: { fontVariant: ["tabular-nums"] },
  statSource: { textAlign: "center" },
  note: { gap: space.sm },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm },
});

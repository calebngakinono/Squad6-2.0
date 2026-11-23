import { router, Stack } from "expo-router";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { Badge, type BadgeTone } from "@/components/badge";
import { Button } from "@/components/button";
import { ButtonRow } from "@/components/button-row";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { Grid, GridCell } from "@/components/grid";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { splitUnit, Stat } from "@/components/stat";
import { FinishTrail } from "@/features/goals/finish-trail";
import { activityInfo, formatDuration, stateOf } from "@/features/workout/machine";
import { ShareWorkoutButton } from "@/features/chat/share-workout-button";
import { OutcomeCard } from "@/features/workout/outcome-card";
import { SetLogger } from "@/features/workout/set-logger";
import { checkHealthEvidence, clearFinishedWorkout, connectAppleHealth, liveSeconds, transitionWorkout } from "@/features/workout/store";
import { formatDistance, formatPace, formatSpeed, usesMiles } from "@/features/workout/tracking/track";
import { useOutcome } from "@/features/workout/use-outcome";
import { useNow, useWorkout } from "@/features/workout/use-workout";
import { space } from "@/theme/tokens";

const STATE_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: "Recording", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  finished: { label: "Finished", tone: "neutral" },
};

// The live workout, and its summary once finished. Glanceable mid-workout: one huge timer, the
// phone's own measurements with their source, and Pause/Finish side by side at the bottom.
export default function WorkoutScreen() {
  const { workout, server, pending, syncing, notice, tracking, health, score } = useWorkout();
  const state = workout ? stateOf(workout.events) : null;
  const now = useNow(state === "active");
  // What happened to the workout once it is on the server (read again while it is being scored).
  const finishedOnServer = state === "finished" && pending === 0 && server && server.state !== "active" && server.state !== "paused";
  const result = useOutcome(finishedOnServer ? server : null, score);

  if (!workout || !state) {
    return (
      <Screen header>
        <Stack.Screen options={{ headerShown: true, title: "Workout" }} />
        <EmptyState
          title="No workout in progress"
          message="Start one from the home screen. The timer runs from the moment you pick an activity."
          action={{ label: "Back", onPress: () => router.back() }}
        />
      </Screen>
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
  // Numbers synced from Apple Health are shown separately, never mixed into the phone's own.
  const official = Object.fromEntries(
    (tracking.metrics ?? []).filter((m) => m.source === "gps" || m.source === "pedometer").map((m) => [m.metric, m.value]),
  );
  const confirmed = tracking.metrics !== null;
  const distance = official.distance_m ?? tracking.distanceM;
  const steps = official.steps ?? tracking.steps;
  const miles = usesMiles(Intl.DateTimeFormat().resolvedOptions().locale);
  const rate = distance == null ? null : workout.activity === "cycle" ? formatSpeed(distance, seconds, miles) : formatPace(distance, seconds, miles);
  const stats = [
    distance != null && { label: "Distance", text: formatDistance(distance, miles), source: "Phone GPS" },
    rate != null && { label: workout.activity === "cycle" ? "Average speed" : "Average pace", text: rate, source: "Phone GPS" },
    steps != null && { label: "Steps", text: steps.toLocaleString(), source: "Phone step counter" },
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

  const badge = STATE_BADGE[state] ?? { label: "Discarded", tone: "danger" as const };
  const finished = !open && state === "finished";

  const measurements = stats.length > 0 && (
    <Card>
      <Grid gap="lg">
        {stats.map((s) => {
          const { value, unit } = splitUnit(s.text);
          return (
            <GridCell key={s.label}>
              <Stat value={value} unit={unit} label={s.label} source={confirmed ? s.source : `${s.source}, live`} />
            </GridCell>
          );
        })}
      </Grid>
      <T variant="caption" tone="textMuted">
        {confirmed ? `Measured by your ${sources}.` : `Live from your ${sources}.`}
      </T>
    </Card>
  );

  const footer = open ? (
    <>
      <ButtonRow>
        {state === "active" ? (
          <Button label="Pause" variant="secondary" onPress={() => transitionWorkout("pause")} />
        ) : (
          <Button label="Resume" onPress={() => transitionWorkout("resume")} />
        )}
        <Button
          label="Finish"
          variant={state === "active" ? "primary" : "secondary"}
          onPress={() =>
            Alert.alert("Finish this workout?", `Active time ${formatDuration(seconds)}.`, [
              { text: "Keep going", style: "cancel" },
              { text: "Finish", onPress: () => transitionWorkout("finish") },
            ])
          }
        />
      </ButtonRow>
      <Button
        label="Discard workout"
        variant="destructiveGhost"
        onPress={() =>
          Alert.alert("Discard this workout?", "It won't count. This can't be undone.", [
            { text: "Keep", style: "cancel" },
            { text: "Discard", style: "destructive", onPress: () => transitionWorkout("cancel") },
          ])
        }
      />
    </>
  ) : (
    <Button
      // Offline, the workout is already safe on this phone and keeps uploading in the background; it
      // is only cleared from the phone once everything has reached the server.
      label={synced ? "Done" : "Back to home"}
      accessibilityHint={synced ? undefined : "The workout keeps uploading in the background"}
      onPress={() => {
        clearFinishedWorkout();
        router.dismissTo("/");
      }}
    />
  );

  return (
    <Screen header footer={footer}>
      <Stack.Screen options={{ headerShown: true, title: info.label, headerBackVisible: !open, gestureEnabled: !open }} />

      <View style={styles.timer}>
        <Badge label={badge.label} tone={badge.tone} />
        <T
          variant="timer"
          align="center"
          // Always one line ("1:02:33"), shrinking to fit at the largest text sizes rather than wrapping.
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityRole="timer"
          accessibilityLabel={`Active time ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds`}
        >
          {formatDuration(seconds)}
        </T>
        <T variant="small" tone="textMuted" align="center">
          Active time
        </T>
        <T variant="caption" tone={synced ? "textMuted" : "warning"} align="center" accessibilityLiveRegion="polite">
          {syncLabel}
        </T>
      </View>

      {notice && <Notice message={notice} />}

      {/* The peak of the loop: today's blaze on the squad's trail, before the points. */}
      {(open || finished) && <FinishTrail open={open} counted={finished && synced} />}

      {gpsNote && (
        <Notice
          message={gpsNote}
          tone={tracking.gps === "denied" || tracking.gps === "unavailable" ? "warning" : "info"}
          action={tracking.gps === "denied" ? { label: "Open Settings", onPress: () => void Linking.openSettings() } : undefined}
        />
      )}

      {finished && synced && result.outcome && (
        <OutcomeCard
          outcome={result.outcome}
          score={result.score}
          activity={workout.activity}
          healthConnected={health.connected}
          retry={() => void result.retry()}
          retrying={result.retrying}
          retryFailed={result.retryFailed}
        />
      )}
      {finished && synced && server && result.outcome && result.outcome.kind !== "scoring" && result.outcome.kind !== "stuck" && (
        <ShareWorkoutButton sessionId={server.id} />
      )}

      {finished && !synced && (
        <Card>
          <T variant="headline">Saved on this phone</T>
          <T tone="textMuted">It uploads as soon as you&apos;re back online. You can leave this screen.</T>
        </Card>
      )}

      {measurements}

      {info.sets && <SetLogger sets={workout.sets} editable={open} />}

      {finished && synced && health.available && (
        <Card>
          <T variant="headline">Apple Health</T>
          {!health.connected ? (
            <>
              <T tone="textMuted">
                Wore a watch or used another fitness app? Connect Apple Health and Squad Six will attach that workout
                as evidence. It reads workouts and heart rate only, and never writes anything.
              </T>
              <Button label="Connect Apple Health" variant="secondary" onPress={() => void connectAppleHealth()} />
            </>
          ) : health.status === "attached" ? (
            <T tone="textMuted" accessibilityLiveRegion="polite">
              {`Matched a workout from ${health.attached?.source_name ?? "another app"}`}
              {health.attached ? `, covering ${Math.round(health.attached.overlap * 100)}% of this one` : ""}
              {health.attached?.hr_avg != null ? `. Average heart rate ${Math.round(health.attached.hr_avg)} bpm` : ""}
              {". Synced from Apple Health after the workout."}
            </T>
          ) : health.status === "closed" ? (
            <T tone="textMuted">Apple Health evidence can no longer be added to this workout.</T>
          ) : health.status === "none" ? (
            <>
              <T tone="textMuted" accessibilityLiveRegion="polite">
                No matching Apple Health workout found yet. Watches can take a while to sync, so Squad Six looks again
                each time you open the app for the next 24 hours.
              </T>
              <Button label="Check again" variant="secondary" onPress={() => void checkHealthEvidence()} />
            </>
          ) : (
            <T tone="textMuted">Looking in Apple Health…</T>
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  timer: { alignItems: "center", gap: space.xs, paddingVertical: space.md },
});

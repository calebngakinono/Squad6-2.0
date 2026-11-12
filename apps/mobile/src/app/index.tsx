import { router, useFocusEffect } from "expo-router";
import type { AthleteStanding } from "@squad-six/shared";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { T } from "@/components/screen-text";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { loadSquadHome, squadApi, type SquadHome } from "@/features/squads/api";
import { squadErrorMessage } from "@/features/squads/errors";
import { loadMySeason } from "@/features/standings/api";
import { formatPoints, seasonYears } from "@/features/standings/view";
import { activityInfo, stateOf } from "@/features/workout/machine";
import { hydrateWorkout } from "@/features/workout/store";
import { useWorkout } from "@/features/workout/use-workout";
import { SquadPanel } from "@/features/squads/squad-panel";
import { space } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

export default function HomeScreen() {
  const c = usePalette();
  const { session } = useSession();
  const userId = session!.user.id;
  const [home, setHome] = useState<SquadHome | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const season = seasonYears(new Date())[0];
  // undefined: not loaded (or couldn't load). null: loaded, no points yet.
  const [mySeason, setMySeason] = useState<AthleteStanding | null | undefined>(undefined);
  const { workout } = useWorkout();
  const workoutState = workout ? stateOf(workout.events) : null;

  const load = useCallback(async () => {
    try {
      setHome(await loadSquadHome(userId));
      setLoadError(null);
      setMySeason(await loadMySeason(season).catch(() => undefined));
    } catch {
      setLoadError("Couldn't load your squad. Pull down to try again.");
    }
  }, [userId, season]);

  useFocusEffect(
    useCallback(() => {
      load();
      // Brings back a workout that was running when the app was closed (saved on the phone or open on the server).
      hydrateWorkout(userId);
    }, [load, userId]),
  );

  // Runs a squad action, shows a friendly error if the server refuses, then reloads.
  function act(fn: () => Promise<unknown>) {
    setBusy(true);
    fn()
      .catch((e) => Alert.alert("Couldn't do that", squadErrorMessage(e)))
      .finally(async () => {
        await load();
        setBusy(false);
      });
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
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
        {workout && (workoutState === "active" || workoutState === "paused") ? (
          <Card>
            <T variant="label">{activityInfo(workout.activity).label} in progress{workoutState === "paused" ? " (paused)" : ""}</T>
            <Button label="Back to workout" onPress={() => router.push("/workout")} />
          </Card>
        ) : workout ? (
          <Button label="View finished workout" variant="secondary" onPress={() => router.push("/workout")} />
        ) : (
          <Button label="Start a workout" onPress={() => router.push("/start-workout")} />
        )}

        <Card>
          <T variant="label">{season} season</T>
          {mySeason ? (
            <T>{`${formatPoints(mySeason.points)} points · rank ${mySeason.rank}`}</T>
          ) : mySeason === null ? (
            <T tone="textMuted">No points yet. They appear here once a workout has been scored.</T>
          ) : null}
          <Button label="Standings" variant="secondary" onPress={() => router.push("/standings")} />
        </Card>

        {loadError && <T tone="danger">{loadError}</T>}
        {home === null && !loadError && <ActivityIndicator accessibilityLabel="Loading" />}

        {home?.kind === "in-squad" && (
          <SquadPanel
            squad={home.squad}
            myUserId={userId}
            busy={busy}
            act={act}
            actions={{
              decide: squadApi.decide,
              remove: squadApi.remove,
              makeCaptain: squadApi.makeCaptain,
              newInviteCode: squadApi.newInviteCode,
              leave: squadApi.leave,
            }}
          />
        )}

        {home?.kind === "no-squad" && (
          <View style={styles.stack}>
            <View style={styles.header}>
              <T variant="title" accessibilityRole="header">
                Find your squad
              </T>
              <T tone="textMuted">Train with up to five other people who are counting on you.</T>
            </View>

            {home.pending.length > 0 && (
              <Card>
                <T variant="label">Waiting for approval</T>
                {home.pending.map((r) => (
                  <View key={r.id} style={styles.pending}>
                    <T>
                      {r.squadName}
                      {r.city ? ` · ${r.city}` : ""}
                    </T>
                    <Button
                      label="Cancel request"
                      variant="secondary"
                      disabled={busy}
                      onPress={() => act(() => squadApi.cancelRequest(r.id))}
                    />
                  </View>
                ))}
              </Card>
            )}

            <Button label="Join with an invite code" onPress={() => router.push("/join")} />
            <Button label="Start a squad" variant="secondary" onPress={() => router.push("/create-squad")} />
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {__DEV__ && (
          <Button variant="secondary" label="Device check (dev only)" onPress={() => router.push("/device-check")} />
        )}
        <Button variant="secondary" label="Sign out" onPress={() => supabase.auth.signOut()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  stack: { gap: space.lg },
  header: { gap: space.sm, paddingTop: space.md },
  pending: { gap: space.sm },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm },
});

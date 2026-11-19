import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, RefreshControl, StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ListGroup } from "@/components/list-group";
import { ListRow } from "@/components/list-row";
import { Loading } from "@/components/loading";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { SectionHeader } from "@/components/section-header";
import { Stat } from "@/components/stat";
import { useSession } from "@/lib/session";
import { loadSquadHome, squadApi, type SquadHome } from "@/features/squads/api";
import { squadErrorMessage } from "@/features/squads/errors";
import { loadMySeasonPoints } from "@/features/standings/api";
import { formatPoints, seasonYears } from "@/features/standings/view";
import { activityInfo, stateOf } from "@/features/workout/machine";
import { hydrateWorkout } from "@/features/workout/store";
import { useWorkout } from "@/features/workout/use-workout";
import { SquadPanel } from "@/features/squads/squad-panel";
import { space } from "@/theme/tokens";

// Home. Top to bottom: who you train with, your season so far, where to go next, then the squad
// itself. The one main action (start or return to a workout) is pinned at the bottom, in thumb reach.
export default function HomeScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const [home, setHome] = useState<SquadHome | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const season = seasonYears(new Date())[0];
  // The athlete's own season total; undefined until loaded (or if it couldn't be loaded).
  const [myPoints, setMyPoints] = useState<number | undefined>(undefined);
  const { workout } = useWorkout();
  const workoutState = workout ? stateOf(workout.events) : null;

  const load = useCallback(async () => {
    try {
      setHome(await loadSquadHome(userId));
      setLoadError(null);
      setMyPoints(await loadMySeasonPoints(season).catch(() => undefined));
    } catch {
      setLoadError("Couldn't load your squad. Check your connection, then try again.");
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

  const squad = home?.kind === "in-squad" ? home.squad : null;
  const workoutOpen = workout && (workoutState === "active" || workoutState === "paused");

  const footer = workoutOpen ? (
    <>
      <T variant="small" tone="textMuted" align="center" accessibilityLiveRegion="polite">
        {`${activityInfo(workout.activity).label} ${workoutState === "paused" ? "paused" : "in progress"}`}
      </T>
      <Button label="Back to workout" onPress={() => router.push("/workout")} />
    </>
  ) : workout ? (
    <Button label="View finished workout" onPress={() => router.push("/workout")} />
  ) : (
    <Button label="Start a workout" onPress={() => router.push("/start-workout")} />
  );

  return (
    <Screen
      footer={footer}
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
      <View style={styles.intro}>
        <SectionHeader
          level="screen"
          title={squad?.name ?? "Squad Six"}
          subtitle={squad ? `${squad.city} · ${squad.members.length} of 6 members` : undefined}
          action={{ label: "Settings", onPress: () => router.push("/settings") }}
        />
        {squad?.description ? <T tone="textMuted">{squad.description}</T> : null}
      </View>

      {loadError && <Notice message={loadError} action={{ label: "Try again", onPress: () => void load() }} />}
      {home === null && !loadError && <Loading label="Loading your squad" />}

      {home?.kind === "no-squad" && (
        <Card>
          <SectionHeader title="Find your squad" subtitle="Train with up to five other people who are counting on you." />
          {home.pending.map((r) => (
            <ListRow
              key={r.id}
              title={r.squadName}
              subtitle={r.city ? `${r.city} · waiting for the captain` : "Waiting for the captain"}
              trailing={
                <Button
                  label="Cancel"
                  variant="ghost"
                  disabled={busy}
                  accessibilityLabel={`Cancel your request to join ${r.squadName}`}
                  onPress={() => act(() => squadApi.cancelRequest(r.id))}
                />
              }
            />
          ))}
          <View style={styles.actions}>
            <Button label="Join with an invite code" variant="secondary" onPress={() => router.push("/join")} />
            <Button label="Start a squad" variant="ghost" onPress={() => router.push("/create-squad")} />
          </View>
        </Card>
      )}

      {myPoints !== undefined && (
        <Card>
          <T variant="label" tone="textMuted">
            {`${season} season`}
          </T>
          {myPoints > 0 ? (
            <Stat size="large" value={formatPoints(myPoints)} unit="pts" label="Your points so far" source="Calculated by Squad Six" />
          ) : (
            <T tone="textMuted">No points yet. They appear here once a workout has been scored.</T>
          )}
        </Card>
      )}

      {/* Where to go next. Add a destination as one more ListRow; the group handles dividers. */}
      <ListGroup>
        <ListRow title="Squad standings" subtitle="Squads in your city, country and the world" onPress={() => router.push("/standings")} />
        {squad && <ListRow title="Squad activity" subtitle="Who has trained this week" onPress={() => router.push("/squad-activity")} />}
        <ListRow title="Challenges" subtitle="Weekly bonus points for your regular workouts" onPress={() => router.push("/challenges")} />
        <ListRow title="My workouts" subtitle="Past workouts and their points" onPress={() => router.push("/history")} />
        {__DEV__ && <ListRow title="Device check" subtitle="Development builds only" onPress={() => router.push("/device-check")} />}
      </ListGroup>

      {squad && (
        <SquadPanel
          squad={squad}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.sm },
  actions: { gap: space.xs },
});

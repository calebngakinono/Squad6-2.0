import { SEP } from "@squad-six/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, Share, StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ListGroup } from "@/components/list-group";
import { ListRow } from "@/components/list-row";
import { Loading } from "@/components/loading";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { SectionHeader } from "@/components/section-header";
import { useSession } from "@/lib/session";
import { takeRouteAfterOnboarding } from "@/features/onboarding/next-route";
import { readPendingInvite } from "@/features/squads/pending-invite";
import { loadWeekGoals } from "@/features/goals/api";
import { WeekStrip } from "@/features/goals/week-strip";
import type { Progress, WeekGoalRow } from "@squad-six/shared";
import { loadSquadHome, squadApi, type SquadHome } from "@/features/squads/api";
import { squadErrorMessage } from "@/features/squads/errors";
import { inviteMessage, inviteReason } from "@/features/squads/invite";
import { loadMyProgress } from "@/features/progress/api";
import { SeasonCard } from "@/features/progress/season-card";
import { seasonYears } from "@/features/standings/view";
import { ACTIVITIES, activityInfo, stateOf, type Activity } from "@/features/workout/machine";
import { loadMyWorkouts } from "@/features/history/api";
import { ButtonRow } from "@/components/button-row";
import { hydrateWorkout, startWorkout } from "@/features/workout/store";
import { useWorkout } from "@/features/workout/use-workout";
import { SquadPanel } from "@/features/squads/squad-panel";
import { space } from "@/theme/tokens";

// Home tab. Top to bottom: the squad's sign, this week's trail, anything waiting on you, your season
// points. The one main action (start or return to a workout) is pinned at the bottom, in thumb reach.
// Everything else has its own tab; the squad's members and invite code are on the Squad tab.
export default function HomeScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const [home, setHome] = useState<SquadHome | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const season = seasonYears(new Date())[0];
  // My own season (points, workouts, goal streak, last 12 weeks); null until loaded or if it failed.
  const [progress, setProgress] = useState<Progress | null>(null);
  // This week's goal progress for me and my squad (null while loading).
  const [goals, setGoals] = useState<WeekGoalRow[] | null>(null);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  // The activity of my most recent workout, for the one-tap "again" button.
  const [lastActivity, setLastActivity] = useState<Activity | null>(null);
  const { workout } = useWorkout();
  const workoutState = workout ? stateOf(workout.events) : null;

  const loadGoals = useCallback(async () => {
    try {
      setGoals(await loadWeekGoals());
      setGoalsError(null);
    } catch {
      setGoalsError("Couldn't load this week. Check your connection, then try again.");
    }
  }, []);

  const load = useCallback(async () => {
    void loadGoals();
    loadMyWorkouts(1)
      .then(([last]) => setLastActivity(ACTIVITIES.find((a) => a.value === last?.activity && a.value !== "other")?.value ?? null))
      .catch(() => {});
    try {
      setHome(await loadSquadHome(userId));
      setLoadError(null);
      setProgress(await loadMyProgress(season).catch(() => null));
    } catch {
      setLoadError("Couldn't load your squad. Check your connection, then try again.");
    }
  }, [userId, season, loadGoals]);

  // Straight after onboarding or sign-in: an invite link that opened the app comes first (its code
  // was saved before the account existed); otherwise Join or Start a squad if that's what they chose.
  useEffect(() => {
    const next = takeRouteAfterOnboarding();
    readPendingInvite().then((code) => {
      if (code) router.push({ pathname: "/join", params: { code } });
      else if (next === "/join" || next === "/create-squad") router.push(next);
    });
  }, []);

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
  ) : lastActivity ? (
    // The daily routine in one tap; anything else is one more.
    <ButtonRow>
      <Button label="Other workout" variant="secondary" onPress={() => router.push("/start-workout")} />
      <Button
        label={`${activityInfo(lastActivity).label} again`}
        accessibilityHint="Starts the timer now"
        onPress={() => {
          if (startWorkout(lastActivity)) router.push("/workout");
        }}
      />
    </ButtonRow>
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
          subtitle={squad ? `${squad.city}${SEP}${squad.members.length} of 6 members` : undefined}
        />
        {squad?.description ? <T tone="textMuted">{squad.description}</T> : null}
      </View>

      {loadError && <Notice message={loadError} action={{ label: "Try again", onPress: () => void load() }} />}

      <WeekStrip
        rows={goals}
        inSquad={home?.kind !== "no-squad"}
        error={goalsError}
        onRetry={() => void loadGoals()}
        onPress={squad ? () => router.navigate("/squad") : undefined}
      />
      {home === null && !loadError && <Loading label="Loading your squad" />}

      {/* Needs the captain's decision, so it comes before anything to browse. */}
      {squad && <SquadPanel squad={squad} myUserId={userId} busy={busy} act={act} part="requests" actions={squadActions} />}

      {/* While the squad has open seats, inviting comes first: the squad is the product. */}
      {squad?.inviteCode && inviteReason(squad.name, squad.members.length) ? (
        <ListGroup>
          <ListRow
            title="Invite your squad"
            subtitle={inviteReason(squad.name, squad.members.length)!}
            accessibilityHint="Opens the share sheet with your invite code"
            onPress={() => Share.share({ message: inviteMessage(squad.name, squad.inviteCode!) })}
          />
        </ListGroup>
      ) : null}

      {/* My own season, squad or no squad: the app is useful from the first workout. */}
      {progress && <SeasonCard progress={progress} season={season} />}

      {/* Without a squad, finding one comes after the person's own progress, not instead of it. */}
      {home?.kind === "no-squad" && (
        <Card>
          <SectionHeader title="Find your squad" subtitle="Train with up to five other people who are counting on you." />
          {home.pending.map((r) => (
            <ListRow
              key={r.id}
              title={r.squadName}
              subtitle={r.city ? `${r.city}${SEP}waiting for the captain` : "Waiting for the captain"}
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

    </Screen>
  );
}

const squadActions = {
  decide: squadApi.decide,
  remove: squadApi.remove,
  makeCaptain: squadApi.makeCaptain,
  newInviteCode: squadApi.newInviteCode,
  leave: squadApi.leave,
};

const styles = StyleSheet.create({
  intro: { gap: space.sm },
  actions: { gap: space.xs },
});

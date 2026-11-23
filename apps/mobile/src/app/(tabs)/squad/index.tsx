import { SEP } from "@squad-six/shared";
import type { SquadActivityRow, WeekGoalRow } from "@squad-six/shared";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, RefreshControl, StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { ListGroup } from "@/components/list-group";
import { ListRow } from "@/components/list-row";
import { Loading } from "@/components/loading";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { SectionHeader } from "@/components/section-header";
import { loadSquadActivity } from "@/features/history/api";
import { activityLabel, dayLabel, outcomeLabel } from "@/features/history/view";
import { loadWeekGoals } from "@/features/goals/api";
import { goalLabel, pips } from "@/features/goals/view";
import { GoalPips } from "@/features/goals/week-strip";
import { loadSquadHome, squadApi, type SquadHome } from "@/features/squads/api";
import { squadErrorMessage } from "@/features/squads/errors";
import { inviteFirst, SquadPanel } from "@/features/squads/squad-panel";
import { useSession } from "@/lib/session";
import { layout } from "@/theme/tokens";

// The Squad tab: who trained this week, what everyone did recently, then the squad itself (members,
// invite code, leave). Summaries only: no routes, distances or health data are ever shown to teammates.
export default function SquadScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const [home, setHome] = useState<SquadHome | null>(null);
  const [rows, setRows] = useState<SquadActivityRow[] | null>(null);
  const [goals, setGoals] = useState<WeekGoalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [h, r, g] = await Promise.all([loadSquadHome(userId), loadSquadActivity(14), loadWeekGoals()]);
      setHome(h);
      setRows(r);
      setGoals(g);
      setError(null);
    } catch {
      setError("Couldn't load your squad's activity. Check your connection, then try again.");
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
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

  const panelActions = {
    decide: squadApi.decide,
    remove: squadApi.remove,
    makeCaptain: squadApi.makeCaptain,
    newInviteCode: squadApi.newInviteCode,
    setHomeCity: squadApi.setHomeCity,
    leave: squadApi.leave,
  };

  const now = new Date();
  const squad = home?.kind === "in-squad" ? home.squad : null;
  const week = squad ? goals : null;
  const trained = week?.filter((m) => m.days_this_week > 0).length ?? 0;

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
      <Stack.Screen options={{ headerShown: true, title: squad?.name ?? "Squad" }} />
      {error && <Notice message={error} action={{ label: "Try again", onPress: () => void load() }} />}
      {(home === null || rows === null || goals === null) && !error && <Loading label="Loading activity" />}
      {home?.kind === "no-squad" && (
        <View style={styles.section}>
          <EmptyState
            title="Not in a squad yet"
            message="Train with up to five other people who are counting on you. Join one with an invite code, or start your own."
            action={{ label: "Join with an invite code", onPress: () => router.push("/join") }}
          />
          <Button label="Start a squad" variant="ghost" onPress={() => router.push("/create-squad")} />
        </View>
      )}

      {/* Too few members to be ranked: getting people in comes before everything else here. */}
      {squad && inviteFirst(squad) && (
        <SquadPanel squad={squad} myUserId={userId} busy={busy} act={act} part="invite" actions={panelActions} />
      )}

      {week && (
        <View style={styles.section}>
          <SectionHeader title="This week" subtitle={`${trained} of ${week.length} have trained${SEP}weeks start Monday`} />
          <ListGroup>
            {week.map((m) => {
              const name = m.is_me ? "You" : (m.display_name ?? "Teammate");
              const reached = m.weekly_goal !== null && m.days_this_week >= m.weekly_goal;
              const label = `${goalLabel(m.days_this_week, m.weekly_goal)} this week`;
              return (
                <ListRow
                  key={m.user_id}
                  title={name}
                  subtitle={m.weekly_goal === null ? `${label}${SEP}no goal set` : label}
                  accessibilityLabel={`${name}, ${label}${reached ? ", goal reached" : ""}`}
                  // Blazes, like the trail sign on Home: all filled once the goal is reached (spoken in the label).
                  trailing={<GoalPips marks={pips(m.days_this_week, m.weekly_goal)} />}
                  highlighted={m.is_me}
                />
              );
            })}
          </ListGroup>
        </View>
      )}

      {squad && rows && (
        <View style={styles.section}>
          <SectionHeader title="Recent workouts" subtitle="The last two weeks" />
          {rows.length === 0 ? (
            <T tone="textMuted">No workouts in the last two weeks. Be the first to get one in.</T>
          ) : (
            <ListGroup>
              {rows.map((r) => (
                <ListRow
                  key={r.session_id}
                  title={`${r.is_me ? "You" : (r.display_name ?? "Athlete")}${SEP}${activityLabel(r.activity)}`}
                  subtitle={`${dayLabel(r.local_date, now)}${SEP}${r.active_minutes} min`}
                  value={outcomeLabel(r.status, r.points)}
                />
              ))}
            </ListGroup>
          )}
        </View>
      )}

      {squad && (
        <SquadPanel
          squad={squad}
          myUserId={userId}
          busy={busy}
          act={act}
          part="manage"
          actions={panelActions}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: layout.headingGap },
});

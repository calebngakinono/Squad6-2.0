import type { SquadActivityRow } from "@squad-six/shared";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { ListGroup } from "@/components/list-group";
import { ListRow } from "@/components/list-row";
import { Loading } from "@/components/loading";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { SectionHeader } from "@/components/section-header";
import { loadSquadActivity } from "@/features/history/api";
import { activityLabel, dayLabel, memberWeek, outcomeLabel } from "@/features/history/view";
import { loadSquadHome, type SquadHome } from "@/features/squads/api";
import { useSession } from "@/lib/session";
import { layout } from "@/theme/tokens";

// Who in my squad trained this week, and what everyone did recently. Summaries only: no routes,
// distances or health data are ever shown to teammates.
export default function SquadActivityScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const [home, setHome] = useState<SquadHome | null>(null);
  const [rows, setRows] = useState<SquadActivityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [h, r] = await Promise.all([loadSquadHome(userId), loadSquadActivity(14)]);
      setHome(h);
      setRows(r);
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

  const now = new Date();
  const squad = home?.kind === "in-squad" ? home.squad : null;
  const week = squad && rows ? memberWeek(squad.members, rows, userId, now) : null;
  const trained = week?.filter((m) => m.workouts > 0).length ?? 0;

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
      <Stack.Screen options={{ headerShown: true, title: squad?.name ?? "Squad activity" }} />
      {error && <Notice message={error} action={{ label: "Try again", onPress: () => void load() }} />}
      {(home === null || rows === null) && !error && <Loading label="Loading activity" />}
      {home?.kind === "no-squad" && (
        <EmptyState
          title="Not in a squad yet"
          message="Join or start a squad to see what your teammates are doing."
          action={{ label: "Back to home", onPress: () => router.back() }}
        />
      )}

      {week && (
        <View style={styles.section}>
          <SectionHeader title="Last 7 days" subtitle={`${trained} of ${week.length} trained`} />
          <ListGroup>
            {week.map((m) => (
              <ListRow
                key={m.userId}
                title={m.isMe ? `${m.name} (you)` : m.name}
                subtitle={m.workouts === 0 ? "No workout yet this week" : `${m.workouts} workout${m.workouts === 1 ? "" : "s"}`}
                trailing={
                  m.workouts === 0 ? <Badge label="Not yet" tone="warning" /> : <Badge label={`${m.points.toLocaleString("en-US")} pts`} tone="accent" />
                }
                highlighted={m.isMe}
              />
            ))}
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
                  title={`${r.is_me ? "You" : (r.display_name ?? "Athlete")} · ${activityLabel(r.activity)}`}
                  subtitle={`${dayLabel(r.local_date, now)} · ${r.active_minutes} min`}
                  value={outcomeLabel(r.status, r.points)}
                />
              ))}
            </ListGroup>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: layout.headingGap },
});

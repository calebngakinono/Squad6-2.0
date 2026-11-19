import type { MyChallenge } from "@squad-six/shared";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, View } from "react-native";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { Stat } from "@/components/stat";
import { joinChallenge, loadMyChallenges } from "@/features/challenges/api";
import {
  formatKm,
  goalLabel,
  joinAction,
  joinErrorMessage,
  joinNote,
  squadProgress,
  tierGoal,
  tierLabel,
  tierReached,
} from "@/features/challenges/view";
import { formatPoints } from "@/features/standings/view";
import { layout, space } from "@/theme/tokens";

// This week's official challenges. Progress, tiers and points all come from the server
// (my_challenges); this screen only shows them and sends Join.
export default function ChallengesScreen() {
  const [challenges, setChallenges] = useState<MyChallenge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setChallenges(await loadMyChallenges());
      setError(null);
    } catch {
      setError("Couldn't load this week's challenges. Pull down to try again.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function join(c: MyChallenge, week: "current" | "next") {
    setJoining(c.challenge_id);
    setJoinError(null);
    try {
      await joinChallenge(c.challenge_id, week);
    } catch (e) {
      setJoinError({ id: c.challenge_id, message: joinErrorMessage(e as { message?: string }) });
    }
    await load();
    setJoining(null);
  }

  const scoringOff = challenges?.some((c) => !c.scoring_on);

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
      <Stack.Screen options={{ headerShown: true, title: "Challenges" }} />
      {error && (
        <T tone="danger" accessibilityLiveRegion="polite">
          {error}
        </T>
      )}
      {challenges === null && !error && <ActivityIndicator accessibilityLabel="Loading challenges" />}
      {challenges?.length === 0 && (
        <EmptyState
          title="No challenges yet"
          message="Challenges appear once your home time zone is set. You can set it in Settings."
        />
      )}
      {scoringOff && (
        <T variant="small" tone="textMuted">
          Points are switched off right now, so challenges don&apos;t award anything yet. Your progress still shows.
        </T>
      )}
      {challenges?.map((c) => (
        <ChallengeCard
          key={c.challenge_id}
          challenge={c}
          busy={joining === c.challenge_id}
          error={joinError?.id === c.challenge_id ? joinError.message : null}
          onJoin={(week) => join(c, week)}
        />
      ))}
      {challenges && challenges.length > 0 && (
        <T variant="small" tone="textMuted">
          Weeks run Monday to Sunday in your home time zone. Only accepted workouts you start after joining count,
          and challenge points are capped at 250 a week.
        </T>
      )}
    </Screen>
  );
}

function ChallengeCard({
  challenge: c,
  busy,
  error,
  onJoin,
}: {
  challenge: MyChallenge;
  busy: boolean;
  error: string | null;
  onJoin: (week: "current" | "next") => void;
}) {
  const action = joinAction(c);
  const note = joinNote(c);
  const squadLine = c.kind === "squad_participation" ? squadProgress(c) : null;

  return (
    <Card>
      <View style={styles.heading}>
        <T variant="headline" accessibilityRole="header" style={styles.title}>
          {c.title}
        </T>
        {c.tier ? (
          <Badge label={tierLabel(c.tier)} tone="success" />
        ) : c.joined ? (
          <Badge label="Joined" tone="accent" />
        ) : null}
      </View>
      <T variant="small" tone="textMuted">
        {c.description}
      </T>

      {c.kind === "individual_tiered" && (
        <View>
          {c.config.tiers.map((t, i) => {
            const reached = tierReached(c.config.tiers, c.tier, t);
            return (
              <ListRow
                key={t.tier}
                title={tierLabel(t.tier)}
                subtitle={tierGoal(t, c.config.distance_goals)}
                value={`${t.points} pts`}
                highlighted={reached}
                trailing={reached ? <Badge label="Reached" tone="success" /> : undefined}
                divider={i < c.config.tiers.length - 1}
              />
            );
          })}
        </View>
      )}

      {c.joined && (
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Stat
              value={String(c.accepted_workouts)}
              label="Accepted workouts"
              source="Scored by Squad Six"
            />
          </View>
          {c.kind === "individual_tiered"
            ? c.config.distance_goals.map((g) => (
                <View key={g.key} style={styles.stat}>
                  <Stat
                    value={formatKm(c.distance_m[g.key] ?? 0)}
                    unit={`of ${formatKm(g.target).replace(/\.0$/, "")} km`}
                    label={goalLabel(g)}
                    source="GPS or health app"
                  />
                </View>
              ))
            : null}
          <View style={styles.stat}>
            <Stat value={formatPoints(c.points)} unit="pts" label="Earned" source="Awarded by Squad Six" />
          </View>
        </View>
      )}

      {squadLine && <T variant="small">{squadLine}</T>}
      {note && (
        <T variant="small" tone="textMuted">
          {note}
        </T>
      )}
      {error && (
        <T variant="small" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </T>
      )}
      {action && (
        <Button
          label={action.label}
          variant="secondary"
          busy={busy}
          disabled={busy}
          accessibilityHint={`Joins ${c.title}`}
          onPress={() => onJoin(action.week)}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { flex: 1 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: layout.stackGap },
  stat: { minWidth: space.xxl * 2, flexGrow: 1 },
});

import type { AthleteStanding, SquadStanding } from "@squad-six/shared";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { T } from "@/components/screen-text";
import { Segmented } from "@/components/segmented";
import { loadAthleteStandings, loadMyCity, loadSquadStandings } from "@/features/standings/api";
import { formatPoints, seasonYears, squadSubtitle } from "@/features/standings/view";
import { useSession } from "@/lib/session";
import { minTouch, space } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

type Board = "athletes" | "squads";
type Scope = "all" | "city";
// `key` says which selection the rows belong to, so a stale list is never shown under new filters.
type Rows = { key: string } & ({ board: "athletes"; rows: AthleteStanding[] } | { board: "squads"; rows: SquadStanding[] });

export default function StandingsScreen() {
  const c = usePalette();
  const { session } = useSession();
  const userId = session!.user.id;
  const years = seasonYears(new Date());
  const [season, setSeason] = useState(years[0]);
  const [board, setBoard] = useState<Board>("athletes");
  const [scope, setScope] = useState<Scope>("all");
  const [myCity, setMyCity] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Rows | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMyCity(userId).then(setMyCity).catch(() => setMyCity(null));
  }, [userId]);

  const city = scope === "city" ? myCity : null;
  const key = `${board}|${season}|${city ?? ""}`;
  const load = useCallback(async () => {
    try {
      const next: Rows =
        board === "athletes"
          ? { key, board, rows: await loadAthleteStandings(season, city) }
          : { key, board, rows: await loadSquadStandings(season, city) };
      setLoaded(next);
      setError(null);
    } catch {
      setError("Couldn't load the standings. Pull down to try again.");
    }
  }, [key, board, season, city]);

  // Loads on open, whenever the selection changes, and again when the screen comes back into view.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const data = loaded?.key === key ? loaded : null;

  const ranked = data?.board === "squads" ? data.rows.filter((r) => r.is_ranked) : [];
  const unranked = data?.board === "squads" ? data.rows.filter((r) => !r.is_ranked) : [];
  const empty = data !== null && data.rows.length === 0;

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.screen, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: true, title: `${season} season` }} />
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
        <View style={styles.controls}>
          <Segmented
            label="Standings for"
            value={board}
            onChange={setBoard}
            options={[
              { value: "athletes", label: "Athletes" },
              { value: "squads", label: "Squads" },
            ]}
          />
          {myCity && (
            <Segmented
              label="Area"
              value={scope}
              onChange={setScope}
              options={[
                { value: "all", label: "Everyone" },
                { value: "city", label: myCity },
              ]}
            />
          )}
          {years.length > 1 && (
            <Segmented label="Season" value={season} onChange={setSeason} options={years.map((y) => ({ value: y, label: String(y) }))} />
          )}
        </View>

        {error && <T tone="danger">{error}</T>}
        {data === null && !error && <ActivityIndicator accessibilityLabel="Loading standings" />}

        {empty && (
          <View style={styles.empty}>
            <T variant="label">No points yet this season</T>
            <T tone="textMuted">
              {board === "athletes"
                ? "Athletes appear here once their workouts have been scored."
                : "Squads appear here once their members' workouts have been scored."}
            </T>
          </View>
        )}

        {data?.board === "athletes" && data.rows.length > 0 && (
          <View>
            {data.rows.map((r) => (
              <Row
                key={r.user_id}
                rank={`${r.rank}`}
                title={r.is_me ? `${r.display_name ?? "You"} (you)` : (r.display_name ?? "Athlete")}
                subtitle={r.city}
                value={formatPoints(r.points)}
                highlight={r.is_me}
              />
            ))}
            <T variant="small" tone="textMuted" style={styles.footnote}>
              Total points from scored workouts this season.
            </T>
          </View>
        )}

        {data?.board === "squads" && data.rows.length > 0 && (
          <View>
            {ranked.map((r) => (
              <Row
                key={r.squad_id}
                rank={`${r.rank}`}
                title={r.is_mine ? `${r.name} (your squad)` : r.name}
                subtitle={squadSubtitle(r)}
                value={formatPoints(r.score)}
                highlight={r.is_mine}
              />
            ))}
            {unranked.length > 0 && (
              <T variant="label" tone="textMuted" accessibilityRole="header" style={styles.sectionTitle}>
                Not ranked yet
              </T>
            )}
            {unranked.map((r) => (
              <Row
                key={r.squad_id}
                rank="–"
                title={r.is_mine ? `${r.name} (your squad)` : r.name}
                subtitle={squadSubtitle(r)}
                value={formatPoints(r.score)}
                highlight={r.is_mine}
              />
            ))}
            <T variant="small" tone="textMuted" style={styles.footnote}>
              Squads are ranked by average points per member, counted by time in the squad, so a squad of four competes
              evenly with a squad of six.
            </T>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ rank, title, subtitle, value, highlight }: { rank: string; title: string; subtitle: string | null; value: string; highlight: boolean }) {
  const c = usePalette();
  return (
    <View
      accessible
      accessibilityLabel={`${rank === "–" ? "Not ranked" : `Rank ${rank}`}, ${title}${subtitle ? `, ${subtitle}` : ""}, ${value} points`}
      style={[styles.row, { borderBottomColor: c.border }]}
    >
      <T tone={highlight ? "accent" : "textMuted"} variant="label" style={styles.rank}>
        {rank}
      </T>
      <View style={styles.rowText}>
        <T variant={highlight ? "label" : "body"} tone={highlight ? "accent" : "text"} numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T variant="small" tone="textMuted" numberOfLines={2}>
            {subtitle}
          </T>
        ) : null}
      </View>
      <T variant="label" tone={highlight ? "accent" : "text"} style={styles.value}>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  controls: { gap: space.sm },
  empty: { gap: space.xs, paddingVertical: space.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: minTouch + space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 32, textAlign: "right", fontVariant: ["tabular-nums"] },
  rowText: { flex: 1, gap: 2 },
  value: { fontVariant: ["tabular-nums"] },
  sectionTitle: { paddingTop: space.lg, paddingBottom: space.xs },
  footnote: { paddingTop: space.md },
});

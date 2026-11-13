import type { SquadStanding, StandingsPlace, StandingsScope } from "@squad-six/shared";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { T } from "@/components/screen-text";
import { Segmented } from "@/components/segmented";
import { loadMyStandingsPlace, loadSquadStandings } from "@/features/standings/api";
import { formatPoints, seasonYears, squadSubtitle } from "@/features/standings/view";
import { minTouch, space } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

// `key` says which selection the rows belong to, so a stale list is never shown under new filters.
type Loaded = { key: string; rows: SquadStanding[] };

// Squad standings for the season: in my city, my country, or the world. Only squads are ranked.
export default function StandingsScreen() {
  const c = usePalette();
  const years = seasonYears(new Date());
  const [season, setSeason] = useState(years[0]);
  const [scope, setScope] = useState<StandingsScope>("world");
  // undefined: not loaded yet. null: the athlete has no city yet.
  const [place, setPlace] = useState<StandingsPlace | null | undefined>(undefined);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMyStandingsPlace()
      .then((p) => {
        setPlace(p);
        if (p) setScope("city"); // start with the board closest to home
      })
      .catch(() => setPlace(null));
  }, []);

  const key = `${season}|${scope}`;
  const load = useCallback(async () => {
    try {
      setLoaded({ key, rows: await loadSquadStandings(season, scope) });
      setError(null);
    } catch {
      setError("Couldn't load the standings. Pull down to try again.");
    }
  }, [key, season, scope]);

  // Loads on open, whenever the selection changes, and again when the screen comes back into view.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const rows = loaded?.key === key ? loaded.rows : null;
  const ranked = rows?.filter((r) => r.is_ranked) ?? [];
  const unranked = rows?.filter((r) => !r.is_ranked) ?? [];
  const area = scope === "city" ? place?.city : scope === "country" ? place?.country : "the world";

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
          {place && (
            <Segmented
              label="Squads in"
              value={scope}
              onChange={setScope}
              options={[
                { value: "city", label: place.city },
                { value: "country", label: place.country },
                { value: "world", label: "World" },
              ]}
            />
          )}
          {place === null && (
            <T variant="small" tone="textMuted">
              Showing squads worldwide. City and country standings appear once you have chosen a city or joined a squad.
            </T>
          )}
          {years.length > 1 && (
            <Segmented label="Season" value={season} onChange={setSeason} options={years.map((y) => ({ value: y, label: String(y) }))} />
          )}
        </View>

        {error && <T tone="danger">{error}</T>}
        {rows === null && !error && <ActivityIndicator accessibilityLabel="Loading standings" />}

        {rows?.length === 0 && (
          <View style={styles.empty}>
            <T variant="label">No squad has points here yet</T>
            <T tone="textMuted">Squads in {area} appear once their members&apos; workouts have been scored.</T>
          </View>
        )}

        {rows && rows.length > 0 && (
          <View>
            {ranked.map((r) => (
              <Row key={r.squad_id} rank={`${r.rank}`} squad={r} />
            ))}
            {unranked.length > 0 && (
              <T variant="label" tone="textMuted" accessibilityRole="header" style={styles.sectionTitle}>
                Not ranked yet
              </T>
            )}
            {unranked.map((r) => (
              <Row key={r.squad_id} rank="–" squad={r} />
            ))}
            <T variant="small" tone="textMuted" style={styles.footnote}>
              A squad&apos;s score is every point its members earned while in it. A squad is ranked once it has four
              members, and keeps everything it earned before that.
            </T>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ rank, squad }: { rank: string; squad: SquadStanding }) {
  const c = usePalette();
  const title = squad.is_mine ? `${squad.name} (your squad)` : squad.name;
  const subtitle = squadSubtitle(squad);
  const value = formatPoints(squad.points);
  const tone = squad.is_mine ? "accent" : "text";
  return (
    <View
      accessible
      accessibilityLabel={`${rank === "–" ? "Not ranked" : `Rank ${rank}`}, ${title}, ${subtitle}, ${value} points`}
      style={[styles.row, { borderBottomColor: c.border }]}
    >
      <T tone={squad.is_mine ? "accent" : "textMuted"} variant="label" style={styles.rank}>
        {rank}
      </T>
      <View style={styles.rowText}>
        <T variant={squad.is_mine ? "label" : "body"} tone={tone} numberOfLines={1}>
          {title}
        </T>
        <T variant="small" tone="textMuted" numberOfLines={2}>
          {subtitle}
        </T>
      </View>
      <T variant="label" tone={tone} style={styles.value}>
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

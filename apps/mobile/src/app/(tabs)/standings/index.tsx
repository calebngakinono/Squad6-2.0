import type { SquadStanding, StandingsPlace, StandingsScope } from "@squad-six/shared";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { Segmented } from "@/components/segmented";
import { loadMyStandingsPlace, loadSquadStandings } from "@/features/standings/api";
import { formatPoints, seasonYears, squadSubtitle } from "@/features/standings/view";
import { layout } from "@/theme/tokens";

// `key` says which selection the rows belong to, so a stale list is never shown under new filters.
type Loaded = { key: string; rows: SquadStanding[] };

// Squad standings for the season: in my city, my country, or the world. Only squads are ranked.
export default function StandingsScreen() {
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
      setError("Couldn't load the standings. Check your connection, then try again.");
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
      <Stack.Screen options={{ headerShown: true, title: `${season} season` }} />
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
          <Notice
            tone="info"
            message="Showing squads worldwide. City and country standings appear once you have chosen a city or joined a squad."
          />
        )}
        {years.length > 1 && (
          <Segmented label="Season" value={season} onChange={setSeason} options={years.map((y) => ({ value: y, label: String(y) }))} />
        )}
      </View>

      {error && <Notice message={error} action={{ label: "Try again", onPress: () => void load() }} />}
      {rows === null && !error && <Loading label="Loading standings" />}

      {rows?.length === 0 && (
        <EmptyState title="No squad has points here yet" message={`Squads in ${area} appear once their members' workouts have been scored.`} />
      )}

      {ranked.length > 0 && (
        <ListGroup>
          {ranked.map((r) => (
            <StandingRow key={r.squad_id} rank={`${r.rank}`} squad={r} />
          ))}
        </ListGroup>
      )}

      {unranked.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Not ranked yet" subtitle="Fewer than four members so far." />
          <ListGroup>
            {unranked.map((r) => (
              <StandingRow key={r.squad_id} rank="–" squad={r} />
            ))}
          </ListGroup>
        </View>
      )}

      {rows && rows.length > 0 && (
        <T variant="small" tone="textMuted">
          A squad&apos;s score is every point its members earned while in it. A squad is ranked once it has four members,
          and keeps everything it earned before that.
        </T>
      )}
    </Screen>
  );
}

function StandingRow({ rank, squad }: { rank: string; squad: SquadStanding }) {
  const title = squad.name;
  const subtitle = squadSubtitle(squad);
  const value = formatPoints(squad.points);
  return (
    <ListRow
      title={title}
      titleLines={1}
      subtitle={subtitle}
      value={value}
      figure
      highlighted={squad.is_mine}
      trailing={squad.is_mine ? <Badge label="You" tone="accent" /> : undefined}
      accessibilityLabel={`${rank === "–" ? "Not ranked" : `Rank ${rank}`}, ${title}${squad.is_mine ? ", your squad" : ""}, ${subtitle}, ${value} points`}
      leading={
        <T variant="label" tone={squad.is_mine ? "accent" : "textMuted"} numeric align="right">
          {rank}
        </T>
      }
    />
  );
}

const styles = StyleSheet.create({
  controls: { gap: layout.headingGap },
  section: { gap: layout.headingGap },
});

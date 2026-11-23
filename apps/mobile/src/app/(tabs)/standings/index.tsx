import type { AthleteStanding, SquadStanding, StandingsPlace, StandingsScope } from "@squad-six/shared";
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
import { loadSquadHome } from "@/features/squads/api";
import {
  loadAthleteStandings,
  loadMyAthletePlace,
  loadMyStandingsPlace,
  loadSquadStandings,
} from "@/features/standings/api";
import { formatPoints, seasonYears, squadSubtitle } from "@/features/standings/view";
import { useSession } from "@/lib/session";
import { layout } from "@/theme/tokens";

type Board = "squads" | "people";
// `key` says which selection the rows belong to, so a stale list is never shown under new filters.
type Loaded = { key: string; squads: SquadStanding[] | null; people: AthleteStanding[] | null };
// undefined: not read yet. null: no city yet.
type Places = { squads: StandingsPlace | null; people: StandingsPlace | null };

// Standings for the season: squads by their home city, people by their own city (Caleb, 2026-11-22).
// City, country or the world. Someone without a squad starts on People, the board they are on.
export default function StandingsScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const years = seasonYears(new Date());
  const [season, setSeason] = useState(years[0]);
  const [board, setBoard] = useState<Board | null>(null);
  const [scope, setScope] = useState<StandingsScope>("world");
  const [places, setPlaces] = useState<Places | undefined>(undefined);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Where each board is centred, and which board to open on. Nothing loads until this is known, so
  // the list never jumps from the world to the city.
  useEffect(() => {
    Promise.all([
      loadMyStandingsPlace().catch(() => null),
      loadMyAthletePlace().catch(() => null),
      loadSquadHome(userId).catch(() => null),
    ]).then(([squads, people, home]) => {
      const start: Board = home?.kind === "in-squad" ? "squads" : "people";
      setPlaces({ squads, people });
      setBoard(start);
      if ((start === "squads" ? squads : people) !== null) setScope("city");
    });
  }, [userId]);

  const place = places && board ? places[board] : undefined;
  // A board without a city falls back to the world.
  const shownScope: StandingsScope = place ? scope : "world";
  const key = `${board}|${season}|${shownScope}`;

  const load = useCallback(async () => {
    if (!board) return;
    try {
      const rows =
        board === "squads"
          ? { squads: await loadSquadStandings(season, shownScope), people: null }
          : { squads: null, people: await loadAthleteStandings(season, shownScope) };
      setLoaded({ key, ...rows });
      setError(null);
    } catch {
      setError("Couldn't load the standings. Check your connection, then try again.");
    }
  }, [board, key, season, shownScope]);

  // Loads on open, whenever the selection changes, and again when the screen comes back into view.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const current = loaded?.key === key ? loaded : null;
  const squads = current?.squads ?? null;
  const people = current?.people ?? null;
  const ranked = squads?.filter((r) => r.is_ranked) ?? [];
  const unranked = squads?.filter((r) => !r.is_ranked) ?? [];
  const area = shownScope === "city" ? place?.city : shownScope === "country" ? place?.country : "the world";
  const empty = board === "squads" ? squads?.length === 0 : people?.filter((p) => !p.is_me || p.points > 0).length === 0;

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
      {!board && <Loading label="Loading standings" />}
      {board && (
        <View style={styles.controls}>
          <Segmented
            label="Rank"
            value={board}
            onChange={(b) => {
              setBoard(b);
              setScope(places?.[b] ? "city" : "world");
            }}
            options={[
              { value: "squads", label: "Squads" },
              { value: "people", label: "People" },
            ]}
          />
          {place && (
            <Segmented
              label={board === "squads" ? "Squads in" : "People in"}
              value={shownScope}
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
              message={
                board === "squads"
                  ? "Showing squads worldwide. City and country standings appear once you've joined a squad or chosen a city."
                  : "Showing people worldwide. City and country rankings appear once you've chosen a city in Settings."
              }
            />
          )}
          {years.length > 1 && (
            <Segmented label="Season" value={season} onChange={setSeason} options={years.map((y) => ({ value: y, label: String(y) }))} />
          )}
        </View>
      )}

      {error && <Notice message={error} action={{ label: "Try again", onPress: () => void load() }} />}
      {board && !current && !error && <Loading label="Loading standings" />}

      {empty && (
        <EmptyState
          title={board === "squads" ? "No squad has points here yet" : "No one has points here yet"}
          message={
            board === "squads"
              ? `Squads in ${area} appear once their members' workouts have been scored.`
              : `People in ${area} appear once a workout of theirs counts. Yours could be the first.`
          }
        />
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

      {people && people.length > 0 && !empty && (
        <ListGroup>
          {people.map((p, i) => (
            <PersonRow key={`${p.rank ?? "me"}-${i}`} person={p} />
          ))}
        </ListGroup>
      )}

      {current && !empty && (
        <T variant="small" tone="textMuted">
          {board === "squads"
            ? "A squad's score is every point its members earned while in it. A squad is ranked once it has four members, and keeps everything it earned before that."
            : "Everyone's counted points this season, from workouts and challenges. Unverified workouts don't count."}
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

function PersonRow({ person }: { person: AthleteStanding }) {
  const name = person.is_me ? "You" : (person.display_name?.trim() || "Athlete");
  const rank = person.rank === null ? "–" : String(person.rank);
  const value = formatPoints(person.points);
  return (
    <ListRow
      title={name}
      titleLines={1}
      subtitle={person.city ?? undefined}
      value={value}
      figure
      highlighted={person.is_me}
      accessibilityLabel={`${person.rank === null ? "Not ranked yet" : `Rank ${rank}`}, ${name}${person.city ? `, ${person.city}` : ""}, ${value} points`}
      leading={
        <T variant="label" tone={person.is_me ? "accent" : "textMuted"} numeric align="right">
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

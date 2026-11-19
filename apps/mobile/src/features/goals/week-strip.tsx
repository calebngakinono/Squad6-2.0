import type { WeekGoalRow } from "@squad-six/shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Notice } from "@/components/notice";
import { T } from "@/components/screen-text";
import { useTheme } from "@/theme/theme";
import { layout, radius, space, state } from "@/theme/tokens";
import { myGoalLine, pips, weekSeats, type Seat } from "./view";

type Props = {
  /** null while loading. */
  rows: WeekGoalRow[] | null;
  inSquad: boolean;
  error: string | null;
  onRetry: () => void;
  /** Opens the squad's week in detail. Absent without a squad. */
  onPress?: () => void;
};

// "This week" at the top of Home: six seats (you first, then teammates, then open seats), each with
// one mark per goal day. Counts only; nothing here earns or costs points.
export function WeekStrip({ rows, inSquad, error, onRetry, onPress }: Props) {
  const t = useTheme();
  const seats = rows ? weekSeats(rows, inSquad) : null;
  const me = rows?.find((r) => r.is_me);
  const reached = me?.weekly_goal != null && me.days_this_week >= me.weekly_goal;
  const list = seats ?? placeholderSeats(inSquad);
  const solo = list.length === 1;
  // As a button, VoiceOver reads the strip as one element, so it carries the whole summary.
  const teammates = rows?.filter((r) => !r.is_me) ?? [];
  const summary = !rows
    ? "This week, loading"
    : [`This week. ${myGoalLine(me)}`, teammates.length > 0 && `${teammates.filter((r) => r.days_this_week > 0).length} of ${teammates.length} teammates have trained`]
        .filter(Boolean)
        .join(". ");

  if (error) return <Notice message={error} action={{ label: "Try again", onPress: onRetry }} />;

  return (
    <Pressable
      accessible={!!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? summary : undefined}
      accessibilityHint={onPress ? "Opens your squad's week" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        // The trail sign: forest board with an olive edge.
        { backgroundColor: pressed ? t.color.surfacePressed : t.color.accentSoft, borderColor: t.color.border },
        pressed && { transform: [{ scale: state.pressedScale }] },
      ]}
    >
      <View style={styles.head}>
        {/* Same height while loading, so nothing jumps when the numbers arrive. */}
        <T variant="headline" tone={reached ? "accent" : "text"} accessibilityLabel={seats ? undefined : "Loading this week"}>
          {seats ? myGoalLine(me) || " " : " "}
        </T>
      </View>
      <View style={[styles.seats, solo && styles.seatsSolo]}>
        {list.map((s) => (
          <SeatView key={s.key} seat={s} loading={!seats} solo={solo} />
        ))}
      </View>
    </Pressable>
  );
}

function placeholderSeats(inSquad: boolean): Seat[] {
  return Array.from({ length: inSquad ? 6 : 1 }, (_, i) => ({ kind: "open", key: `loading-${i}` }));
}

function SeatView({ seat, loading, solo }: { seat: Seat; loading: boolean; solo: boolean }) {
  const t = useTheme();
  if (seat.kind === "open") {
    // Open and loading seats are pictures only; the strip's line says what matters.
    return (
      <View style={[styles.seat, solo && styles.seatSolo]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.face, loading ? { backgroundColor: t.color.surfaceSunken } : styles.openFace, !loading && { borderColor: t.color.textMuted }]} />
        <T variant="caption" tone="textMuted" numberOfLines={1}>
          {loading ? " " : "Open"}
        </T>
      </View>
    );
  }
  return (
    <View style={[styles.seat, solo && styles.seatSolo]} accessible accessibilityLabel={seat.spoken}>
      <T variant="label" tone={seat.reached || seat.isMe ? "accent" : "textMuted"} numeric>
        {seat.goal === null ? String(seat.days) : `${seat.days}/${seat.goal}`}
      </T>
      <Blazes marks={pips(seat.days, seat.goal)} bright={seat.isMe} vertical />
      <View style={[styles.face, { backgroundColor: seat.isMe ? t.color.accent : t.color.surfaceRaised }]}>
        <T variant="caption" tone={seat.isMe ? "onAccent" : "accent"}>
          {seat.initials}
        </T>
      </View>
      <T variant="caption" tone="textMuted" numberOfLines={1}>
        {seat.name}
      </T>
    </View>
  );
}

/**
 * The trail blazes: one painted mark per goal day, filled for days trained, hollow for days left.
 * Vertical in the this-week sign (filled from the bottom, like a climbing trail), horizontal in rows.
 * Decorative: the seat or row speaks the numbers. `bright` marks your own trail.
 */
export function Blazes({ marks, bright = false, vertical = false }: { marks: boolean[]; bright?: boolean; vertical?: boolean }) {
  const t = useTheme();
  const fill = bright ? t.color.text : t.color.accent;
  const ordered = vertical ? [...marks].reverse() : marks;
  return (
    <View
      style={vertical ? styles.blazesV : styles.blazesH}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ordered.map((on, i) => (
        <View
          key={i}
          style={[
            vertical ? styles.blazeV : styles.blazeH,
            on ? { backgroundColor: fill, borderColor: fill } : { borderColor: t.color.textMuted },
          ]}
        />
      ))}
    </View>
  );
}

/** Kept for rows that show a member's week (Squad activity). */
export const GoalPips = ({ marks }: { marks: boolean[] }) => <Blazes marks={marks} />;

const FACE = 34;

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderCurve: "continuous", padding: layout.cardPadding, gap: space.lg, borderWidth: StyleSheet.hairlineWidth },
  head: { gap: space.xxs },
  // Every seat stands on one shared baseline, so the six trails compare at a glance.
  seats: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: space.xs },
  seatsSolo: { justifyContent: "flex-start" },
  seat: { flex: 1, alignItems: "center", gap: space.xs + 1, minWidth: 0 },
  seatSolo: { flex: 0, minWidth: FACE + space.xl },
  face: { width: FACE, height: FACE, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: space.xs },
  openFace: { borderWidth: 1.5, borderStyle: "dashed" },
  blazesV: { gap: 5, alignItems: "center" },
  blazeV: { width: 18, height: 10, borderRadius: 2, borderWidth: 1.5 },
  blazesH: { flexDirection: "row", gap: 4, alignItems: "center" },
  blazeH: { width: 12, height: 8, borderRadius: 2, borderWidth: 1.5 },
});

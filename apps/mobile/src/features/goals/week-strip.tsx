import type { WeekGoalRow } from "@squad-six/shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Notice } from "@/components/notice";
import { T } from "@/components/screen-text";
import { elevationStyle, useTheme } from "@/theme/theme";
import { borderWidth, layout, radius, space, state } from "@/theme/tokens";
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
        { backgroundColor: pressed ? t.color.surfacePressed : t.color.surface },
        elevationStyle(t.elevation.raised, t.color),
        pressed && { transform: [{ scale: state.pressedScale }] },
      ]}
    >
      <View style={styles.head}>
        <T variant="label" tone="textMuted">
          This week
        </T>
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
        <View
          style={[styles.face, loading ? { backgroundColor: t.color.surfaceSunken } : { borderWidth: borderWidth.thin, borderStyle: "dashed", borderColor: t.color.borderStrong }]}
        />
        <T variant="caption" tone="textMuted" numberOfLines={1}>
          {loading ? " " : "Open"}
        </T>
      </View>
    );
  }
  const marks = pips(seat.days, seat.goal);
  return (
    <View style={[styles.seat, solo && styles.seatSolo]} accessible accessibilityLabel={seat.spoken}>
      <View
        style={[
          styles.face,
          seat.isMe
            ? { backgroundColor: t.color.accent }
            : { backgroundColor: seat.reached ? t.color.accentSoft : t.color.surfaceSunken },
        ]}
      >
        <T variant="label" tone={seat.isMe ? "onAccent" : seat.reached ? "accent" : "text"}>
          {seat.initials}
        </T>
      </View>
      <GoalPips marks={marks} />
      <T variant="caption" tone="textMuted" numberOfLines={1}>
        {seat.name}
      </T>
    </View>
  );
}

/** One mark per goal day, filled for days trained. Decorative: the row or seat speaks the numbers. */
export function GoalPips({ marks }: { marks: boolean[] }) {
  const t = useTheme();
  return (
    <View style={styles.pips} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {marks.map((on, i) => (
        <View key={i} style={[styles.pip, { backgroundColor: on ? t.color.accent : t.color.surfaceSunken }]} />
      ))}
    </View>
  );
}

const FACE = 44;
const PIP = 5;

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderCurve: "continuous", padding: layout.cardPadding, gap: space.lg },
  head: { gap: space.xxs },
  seats: { flexDirection: "row", justifyContent: "space-between", gap: space.xs },
  seatsSolo: { justifyContent: "flex-start" },
  seat: { flex: 1, alignItems: "center", gap: space.xs, minWidth: 0 },
  seatSolo: { flex: 0, minWidth: FACE + space.lg },
  face: { width: FACE, height: FACE, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  pips: { flexDirection: "row", gap: 3, minHeight: PIP },
  pip: { width: PIP, height: PIP, borderRadius: radius.pill },
});

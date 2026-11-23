import type { WeekGoalRow } from "@squad-six/shared";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { T } from "@/components/screen-text";
import { useSession } from "@/lib/session";
import { loadSquadHome } from "@/features/squads/api";
import { space } from "@/theme/tokens";
import { loadWeekGoals } from "./api";
import { finishTrailLine, isNewDay } from "./view";
import { WeekStrip } from "./week-strip";

type Props = {
  /** The workout is still recording or paused: the moment to read my day count "before". */
  open: boolean;
  /** Finished and fully on the server, so this week's counts include it. */
  counted: boolean;
};

// The top of a finished workout: my trail with today's blaze, next to my squad's. Counts come from the
// server (squad_week_goals) after the finish has synced; the client never adds a day itself. Shows
// nothing until loaded, or if loading fails (Home shows the same trail with its own retry).
export function FinishTrail({ open, counted }: Props) {
  const { session } = useSession();
  const userId = session?.user.id;
  // My days this week as read while the workout was still open. null: never read on this screen.
  const before = useRef<number | null>(null);
  const [week, setWeek] = useState<{ rows: WeekGoalRow[]; inSquad: boolean; newDay: boolean | null } | null>(null);

  useEffect(() => {
    if (!open) return;
    loadWeekGoals()
      .then((rows) => {
        before.current = rows.find((r) => r.is_me)?.days_this_week ?? null;
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!counted || !userId) return;
    let live = true;
    Promise.all([loadWeekGoals(), loadSquadHome(userId)])
      .then(([rows, home]) => {
        const newDay = before.current === null ? null : isNewDay(before.current, rows.find((r) => r.is_me));
        if (live) setWeek({ rows, inSquad: home.kind === "in-squad", newDay });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [counted, userId]);

  if (!week) return null;
  const line = finishTrailLine(week.newDay, week.rows.length - 1);

  return (
    <View style={styles.wrap}>
      <WeekStrip rows={week.rows} inSquad={week.inSquad} error={null} onRetry={() => {}} freshDay={week.newDay === true} />
      {line ? (
        <T variant="small" tone="textMuted" accessibilityLiveRegion="polite">
          {line}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
});

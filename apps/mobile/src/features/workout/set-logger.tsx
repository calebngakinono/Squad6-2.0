import { useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Pill } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ListRow } from "@/components/list-row";
import { T } from "@/components/screen-text";
import { TextField } from "@/components/text-field";
import { space } from "@/theme/tokens";
import { deleteSet, logSet, type LocalSet } from "./store";

// Each tap of "Log set" records the set at that moment: logging sets live is what makes a strength
// workout count as evidence (docs/scoring-proposal.md §1.2.1).
export function SetLogger({ sets, editable }: { sets: LocalSet[]; editable: boolean }) {
  const visible = sets.filter((s) => !s.deleted);
  const last = visible[visible.length - 1];
  const [exercise, setExercise] = useState(last?.exercise ?? "");
  const [reps, setReps] = useState(last ? String(last.reps) : "");
  const [weight, setWeight] = useState(last?.weightKg != null ? String(last.weightKg) : "");
  const recent = useMemo(() => [...new Set(visible.map((s) => s.exercise).reverse())].slice(0, 4), [visible]);

  const repsNum = Number(reps);
  const weightNum = weight.trim() === "" ? null : Number(weight.replace(",", "."));
  const valid =
    exercise.trim().length > 0 &&
    Number.isInteger(repsNum) &&
    repsNum >= 1 &&
    repsNum <= 100 &&
    (weightNum === null || (Number.isFinite(weightNum) && weightNum >= 0 && weightNum <= 500));

  const listed = visible.slice().reverse();

  return (
    <Card>
      <View style={styles.head}>
        <T variant="headline" accessibilityRole="header">
          Sets
        </T>
        <T variant="label" tone="textMuted" numeric>
          {`${visible.length} logged`}
        </T>
      </View>
      {editable && (
        <>
          <TextField label="Exercise" value={exercise} onChangeText={setExercise} maxLength={60} autoCapitalize="words" />
          {recent.length > 0 && (
            <View style={styles.pills} accessibilityLabel="Recent exercises">
              {recent.map((r) => (
                <Pill key={r} label={r} selected={exercise === r} onPress={() => setExercise(r)} />
              ))}
            </View>
          )}
          <View style={styles.row}>
            <View style={styles.grow}>
              <TextField label="Reps" value={reps} onChangeText={setReps} keyboardType="number-pad" maxLength={3} />
            </View>
            <View style={styles.grow}>
              <TextField label="Weight (kg)" helper="Optional" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" maxLength={5} />
            </View>
          </View>
          <Button label="Log set" disabled={!valid} onPress={() => logSet(exercise, repsNum, weightNum)} />
        </>
      )}
      {listed.length > 0 && (
        <View>
          {listed.map((s, i) => (
            <ListRow
              key={s.id}
              leading={
                <T variant="label" tone="textMuted" numeric>
                  {visible.length - i}
                </T>
              }
              title={s.exercise}
              subtitle={`${s.reps} reps${s.weightKg != null ? ` · ${s.weightKg} kg` : ""}`}
              divider={i < listed.length - 1}
              trailing={
                editable ? (
                  <Button
                    label="Remove"
                    variant="destructiveGhost"
                    accessibilityLabel={`Remove set ${visible.length - i}, ${s.exercise}`}
                    onPress={() =>
                      Alert.alert("Remove this set?", undefined, [
                        { text: "Keep", style: "cancel" },
                        { text: "Remove", style: "destructive", onPress: () => deleteSet(s.id) },
                      ])
                    }
                  />
                ) : undefined
              }
            />
          ))}
        </View>
      )}
      <T variant="caption" tone="textMuted">
        Entered by you (manual). Weight is never used for points.
      </T>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
  pills: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  row: { flexDirection: "row", gap: space.sm },
  grow: { flex: 1 },
});

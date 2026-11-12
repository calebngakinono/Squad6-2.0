import { useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
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

  return (
    <Card>
      <T variant="label">Sets ({visible.length})</T>
      {editable && (
        <>
          <TextField label="Exercise" value={exercise} onChangeText={setExercise} maxLength={60} autoCapitalize="words" />
          {recent.length > 0 && (
            <View style={styles.row}>
              {recent.map((r) => (
                <Button key={r} label={r} variant="secondary" onPress={() => setExercise(r)} />
              ))}
            </View>
          )}
          <View style={styles.row}>
            <View style={styles.grow}>
              <TextField label="Reps" value={reps} onChangeText={setReps} keyboardType="number-pad" maxLength={3} />
            </View>
            <View style={styles.grow}>
              <TextField label="Weight (kg, optional)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" maxLength={5} />
            </View>
          </View>
          <Button label="Log set" disabled={!valid} onPress={() => logSet(exercise, repsNum, weightNum)} />
        </>
      )}
      {visible
        .slice()
        .reverse()
        .map((s, i) => (
          <View key={s.id} style={styles.setRow}>
            <T style={styles.grow}>
              {visible.length - i}. {s.exercise} · {s.reps} reps{s.weightKg != null ? ` · ${s.weightKg} kg` : ""}
            </T>
            {editable && (
              <Button
                label="Remove"
                variant="secondary"
                onPress={() =>
                  Alert.alert("Remove this set?", undefined, [
                    { text: "Keep", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: () => deleteSet(s.id) },
                  ])
                }
              />
            )}
          </View>
        ))}
      <T variant="small" tone="textMuted">
        Entered by you (manual). Weight is never used for points.
      </T>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  grow: { flex: 1 },
  setRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
});

import { router, Stack } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { T } from "@/components/screen-text";
import { ACTIVITIES } from "@/features/workout/machine";
import { startWorkout } from "@/features/workout/store";
import { minTouch, radius, space } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

export default function StartWorkoutScreen() {
  const c = usePalette();
  return (
    <SafeAreaView edges={["bottom"]} style={[styles.screen, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: true, title: "Start a workout" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <T tone="textMuted">The timer starts as soon as you pick an activity.</T>
        <View style={styles.grid}>
          {ACTIVITIES.map((a) => (
            <Pressable
              key={a.value}
              accessibilityRole="button"
              accessibilityLabel={`Start ${a.label}`}
              onPress={() => {
                if (startWorkout(a.value)) router.replace("/workout");
              }}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <T variant="label">{a.label}</T>
              <T variant="small" tone="textMuted">
                {a.gps ? "GPS" : a.sets ? "Log sets" : "Timer"}
              </T>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: {
    width: "48%",
    minHeight: minTouch * 2,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    justifyContent: "space-between",
  },
});

import { router, Stack } from "expo-router";
import { Grid } from "@/components/grid";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { Tile } from "@/components/tile";
import { ACTIVITIES } from "@/features/workout/machine";
import { startWorkout } from "@/features/workout/store";

// Pick an activity; the timer starts on the tap.
export default function StartWorkoutScreen() {
  return (
    <Screen header>
      <Stack.Screen options={{ headerShown: true, title: "Start a workout" }} />
      <T tone="textMuted">The timer starts as soon as you pick an activity.</T>
      <Grid>
        {ACTIVITIES.map((a) => (
          <Tile
            key={a.value}
            title={a.label}
            caption={a.gps ? "Tracks distance with GPS" : a.sets ? "Log your sets" : "Time only"}
            accessibilityLabel={`Start ${a.label}`}
            accessibilityHint="Starts the timer now"
            onPress={() => {
              if (startWorkout(a.value)) router.replace("/workout");
            }}
          />
        ))}
      </Grid>
    </Screen>
  );
}

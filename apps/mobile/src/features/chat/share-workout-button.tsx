import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { T } from "@/components/screen-text";
import { loadSquadHome } from "@/features/squads/api";
import { useSession } from "@/lib/session";
import { space } from "@/theme/tokens";
import { chatApi, chatErrorMessage } from "./api";

/**
 * "Share to squad chat" for one of my finished workouts. The server builds the summary from its own
 * records (activity, minutes, counted points or "unverified"), so a share can't claim more than was
 * earned. Hidden without a squad.
 */
export function ShareWorkoutButton({ sessionId }: { sessionId: string }) {
  const { session } = useSession();
  const userId = session?.user.id;
  const [squadName, setSquadName] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sharing" | "shared">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    loadSquadHome(userId).then(
      (h) => setSquadName(h.kind === "in-squad" ? h.squad.name : null),
      () => setSquadName(null),
    );
  }, [userId]);

  if (!squadName) return null;

  if (state === "shared") {
    return (
      <View style={styles.done}>
        <T variant="small" tone="textMuted" accessibilityLiveRegion="polite">
          {`Shared with ${squadName}.`}
        </T>
        <Button label="Open squad chat" variant="ghost" onPress={() => router.push("/chat")} />
      </View>
    );
  }

  return (
    <View style={styles.done}>
      <Button
        label="Share to squad chat"
        variant="secondary"
        busy={state === "sharing"}
        onPress={async () => {
          setState("sharing");
          setError(null);
          try {
            await chatApi.shareWorkout(sessionId);
            setState("shared");
          } catch (e) {
            setError(chatErrorMessage(e));
            setState("idle");
          }
        }}
      />
      {error && <Notice message={error} />}
    </View>
  );
}

const styles = StyleSheet.create({
  done: { gap: space.xs },
});

import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { space, type } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

// Placeholder home until squads and live workouts land. Shows only real account data.
export default function HomeScreen() {
  const c = usePalette();
  const { session } = useSession();
  const [busy, setBusy] = useState(false);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[type.title, { color: c.text }]}>
          You&apos;re in
        </Text>
        <Text style={[type.body, { color: c.textMuted }]}>Signed in as {session?.user.email}</Text>
        <Text style={[type.body, { color: c.textMuted }]}>
          Squads and live workouts arrive in the next builds.
        </Text>
      </View>
      <View style={styles.actions}>
        {__DEV__ && (
          <Button variant="secondary" label="Device check (dev only)" onPress={() => router.push("/device-check")} />
        )}
        <Button
        variant="secondary"
        label="Sign out"
        busy={busy}
        onPress={async () => {
          setBusy(true);
          await supabase.auth.signOut();
          setBusy(false);
        }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "space-between", padding: space.lg },
  header: { gap: space.sm, paddingTop: space.xl },
  actions: { gap: space.md },
});

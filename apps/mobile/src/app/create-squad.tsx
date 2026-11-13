import { router, Stack } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { CityPicker } from "@/components/city-picker";
import { T } from "@/components/screen-text";
import { TextField } from "@/components/text-field";
import { squadApi } from "@/features/squads/api";
import { squadErrorMessage } from "@/features/squads/errors";
import { space } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

export default function CreateSquadScreen() {
  const c = usePalette();
  const [name, setName] = useState("");
  const [cityId, setCityId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length >= 2 && cityId !== null;

  async function submit() {
    if (cityId === null) return;
    setBusy(true);
    setError(null);
    try {
      await squadApi.create(name.trim(), cityId, description.trim());
      router.back();
    } catch (e) {
      setError(squadErrorMessage(e as { message?: string }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.screen, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: true, title: "Start a squad" }} />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <T tone="textMuted">You&apos;ll be the captain. Share the invite code and approve who joins, up to six people.</T>
          <TextField label="Squad name" value={name} onChangeText={setName} maxLength={40} autoCapitalize="words" />
          <CityPicker label="City" value={cityId} onChange={setCityId} />
          <T variant="small" tone="textMuted">
            Squads compete with others in the same city and country. Only the city is shown, never an exact location.
          </T>
          <TextField
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            maxLength={280}
            multiline
          />
          {error && (
            <T variant="small" tone="danger" accessibilityLiveRegion="polite">
              {error}
            </T>
          )}
          <Button label="Create squad" onPress={submit} busy={busy} disabled={!valid} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space.lg, gap: space.md },
});

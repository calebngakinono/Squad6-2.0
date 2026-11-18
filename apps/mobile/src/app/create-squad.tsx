import { router, Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { CityPicker } from "@/components/city-picker";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { TextField } from "@/components/text-field";
import { squadApi } from "@/features/squads/api";
import { squadErrorMessage } from "@/features/squads/errors";
import { space } from "@/theme/tokens";

export default function CreateSquadScreen() {
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
    <Screen
      header
      footer={
        <>
          {error && <Notice message={error} />}
          <Button label="Create squad" onPress={submit} busy={busy} disabled={!valid} />
        </>
      }
    >
      <Stack.Screen options={{ headerShown: true, title: "Start a squad" }} />
      <T tone="textMuted">You&apos;ll be the captain. Share the invite code and approve who joins, up to six people.</T>
      <View style={styles.form}>
        <TextField
          label="Squad name"
          helper="At least 2 characters."
          value={name}
          onChangeText={setName}
          maxLength={40}
          autoCapitalize="words"
        />
        <View style={styles.field}>
          <CityPicker label="City" value={cityId} onChange={setCityId} />
          <T variant="small" tone="textMuted">
            Squads compete with others in the same city and country. Only the city is shown, never an exact location.
          </T>
        </View>
        <TextField label="Description (optional)" value={description} onChangeText={setDescription} maxLength={280} multiline />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  field: { gap: space.sm },
});

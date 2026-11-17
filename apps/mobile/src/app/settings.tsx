import Constants from "expo-constants";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, Platform, StyleSheet, View } from "react-native";
import { Pill } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { CityPicker } from "@/components/city-picker";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { SectionHeader } from "@/components/section-header";
import { TextField } from "@/components/text-field";
import { deviceTimeZone } from "@/features/onboarding/api";
import { loadSettings, settingsApi, settingsErrorMessage, type AccountSettings } from "@/features/settings/api";
import { connectAppleHealth } from "@/features/workout/store";
import { useWorkout } from "@/features/workout/use-workout";
import { getWebsiteUrl } from "@/lib/env";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { space } from "@/theme/tokens";

const GOAL_DAYS = [1, 2, 3, 4, 5, 6, 7];

export default function SettingsScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const { health } = useWorkout();
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [name, setName] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const website = getWebsiteUrl();
  const phoneZone = deviceTimeZone();

  const load = useCallback(async () => {
    try {
      const s = await loadSettings(userId);
      setSettings(s);
      setName(s.displayName);
      setLoadError(null);
    } catch {
      setLoadError("Couldn't load your settings. Check your connection and try again.");
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Runs one change, shows the outcome, and reloads so the screen shows what the server stored.
  async function save(key: string, fn: () => Promise<void>, done: string) {
    setSaving(key);
    setMessage(null);
    try {
      await fn();
      setMessage({ text: done, error: false });
      await load();
    } catch (e) {
      setMessage({ text: settingsErrorMessage(e), error: true });
    } finally {
      setSaving(null);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your profile, workouts, routes and Apple Health summaries, and removes you from your squad. Points you already earned for your squad stay in its total but no longer show your name. This can't be undone.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () =>
            void (async () => {
              setSaving("delete");
              try {
                await settingsApi.deleteAccount();
              } catch (e) {
                setSaving(null);
                Alert.alert("Couldn't delete your account", settingsErrorMessage(e));
              }
            })(),
        },
      ],
    );
  }

  const nameChanged = settings !== null && name.trim() !== settings.displayName && name.trim().length > 0;

  return (
    <Screen header>
      <Stack.Screen options={{ headerShown: true, title: "Settings" }} />

      {loadError && (
        <View style={styles.stack}>
          <T tone="danger">{loadError}</T>
          <Button label="Try again" variant="secondary" onPress={load} />
        </View>
      )}
      {message && (
        <T variant="small" tone={message.error ? "danger" : "success"} accessibilityLiveRegion="polite">
          {message.text}
        </T>
      )}

      {settings && (
        <>
          <View style={styles.stack}>
            <SectionHeader title="Profile" subtitle="Your squad and other athletes see your name and city." />
            <TextField label="Name" value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" textContentType="name" />
            {nameChanged && (
              <Button
                label="Save name"
                variant="secondary"
                busy={saving === "name"}
                onPress={() => save("name", () => settingsApi.setDisplayName(userId, name), "Name saved.")}
              />
            )}
            <CityPicker
              label="City"
              value={settings.cityId}
              onChange={(id) => {
                if (id !== null && id !== settings.cityId) void save("city", () => settingsApi.setCity(userId, id), "City saved.");
              }}
            />
          </View>

          <View style={styles.stack}>
            <SectionHeader title="Training" />
            <T variant="label">Weekly goal</T>
            <T variant="small" tone="textMuted">
              Days a week you want to train. A personal goal; it doesn&apos;t change your points.
            </T>
            <View style={styles.pills} accessibilityRole="radiogroup" accessibilityLabel="Weekly goal in days">
              {GOAL_DAYS.map((d) => (
                <Pill
                  key={d}
                  label={String(d)}
                  selected={settings.weeklyCommitment === d}
                  disabled={saving !== null}
                  accessibilityLabel={`${d} day${d === 1 ? "" : "s"} a week`}
                  onPress={() => save("goal", () => settingsApi.setWeeklyCommitment(userId, d), "Weekly goal saved.")}
                />
              ))}
            </View>
            <ListRow
              title="Home time zone"
              subtitle="Decides which day a workout counts for. It can change once a week."
              value={settings.homeTimezone ?? "Not set"}
            />
            {phoneZone && phoneZone !== settings.homeTimezone && (
              <Button
                label={`Use this phone's time zone (${phoneZone})`}
                variant="secondary"
                busy={saving === "tz"}
                onPress={() => save("tz", () => settingsApi.setHomeTimezone(phoneZone), "Time zone saved.")}
              />
            )}
          </View>

          {Platform.OS === "ios" && health.available && (
            <View style={styles.stack}>
              <SectionHeader title="Apple Health" />
              <Card variant="outlined">
                <T>{health.connected ? "Connected" : "Not connected"}</T>
                <T variant="small" tone="textMuted">
                  {health.connected
                    ? "After a workout, Squad Six looks for a matching workout from your watch or another app and attaches it as evidence. It reads workouts and heart rate only and never writes anything. To stop, turn off access in the Health app → Sharing → Apps → Squad Six."
                    : "Wore a watch or used another fitness app? Connect Apple Health and matching workouts are attached as evidence. Squad Six reads workouts and heart rate only and never writes anything."}
                </T>
                {!health.connected && <Button label="Connect Apple Health" variant="secondary" onPress={() => void connectAppleHealth()} />}
              </Card>
            </View>
          )}

          <View style={styles.stack}>
            <SectionHeader title="Account" />
            <ListRow title="Email" value={settings.email ?? "–"} />
            <Button label="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
            <Button label="Delete account" variant="destructive" busy={saving === "delete"} onPress={confirmDelete} />
          </View>

          <View style={styles.stack}>
            <SectionHeader title="About" />
            {website && (
              <>
                <ListRow title="Privacy policy" chevron onPress={() => Linking.openURL(`${website}/privacy`)} />
                <ListRow title="Terms of use" chevron onPress={() => Linking.openURL(`${website}/terms`)} />
                <ListRow title="Help and support" chevron onPress={() => Linking.openURL(`${website}/support`)} divider={false} />
              </>
            )}
            <T variant="caption" tone="textMuted">
              Squad Six {Constants.expoConfig?.version ?? ""}. City data © GeoNames (geonames.org), CC BY 4.0.
            </T>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});

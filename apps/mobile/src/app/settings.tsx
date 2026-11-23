import Constants from "expo-constants";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Platform, StyleSheet, Switch, View } from "react-native";
import { Badge, Pill } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { CityPicker } from "@/components/city-picker";
import { ListGroup } from "@/components/list-group";
import { ListRow } from "@/components/list-row";
import { Loading } from "@/components/loading";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { SectionHeader } from "@/components/section-header";
import { Segmented } from "@/components/segmented";
import { TextField } from "@/components/text-field";
import { deviceTimeZone } from "@/features/onboarding/api";
import { ChangePassword } from "@/features/auth/change-password";
import { loadSettings, settingsApi, settingsErrorMessage, type AccountSettings } from "@/features/settings/api";
import { loadAppearance, setAppearance } from "@/features/settings/appearance";
import { APPEARANCE_CHOICES, type AppearanceChoice } from "@/features/settings/appearance-choice";
import { connectAppleHealth } from "@/features/workout/store";
import { useWorkout } from "@/features/workout/use-workout";
import { getWebsiteUrl } from "@/lib/env";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/theme";
import { layout, minTouch, space } from "@/theme/tokens";

const GOAL_DAYS = [1, 2, 3, 4, 5, 6, 7];

type SaveKey = "name" | "city" | "goal" | "tz" | "rankings";

export default function SettingsScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const { health } = useWorkout();
  const t = useTheme();
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [name, setName] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  // Which change the message is about, so it shows next to that control rather than at the top of
  // the screen where it may be scrolled out of view.
  const [message, setMessage] = useState<{ key: SaveKey; text: string; error: boolean } | null>(null);
  // Light or dark for this phone; null until the saved choice is read.
  const [appearance, setAppearanceChoice] = useState<AppearanceChoice | null>(null);
  useEffect(() => {
    loadAppearance().then(setAppearanceChoice);
  }, []);
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
  async function save(key: SaveKey, fn: () => Promise<void>, done: string) {
    setSaving(key);
    setMessage(null);
    try {
      await fn();
      setMessage({ key, text: done, error: false });
      await load();
    } catch (e) {
      setMessage({ key, text: settingsErrorMessage(e), error: true });
    } finally {
      setSaving(null);
    }
  }

  const feedback = (...keys: SaveKey[]) =>
    message && keys.includes(message.key) ? <Notice message={message.text} tone={message.error ? "danger" : "success"} /> : null;

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

      {loadError && <Notice message={loadError} action={{ label: "Try again", onPress: () => void load() }} />}
      {!settings && !loadError && <Loading label="Loading settings" />}

      {settings && (
        <>
          <View style={styles.section}>
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
            {feedback("name", "city")}
          </View>

          <View style={styles.section}>
            <SectionHeader title="Training" />
            <View style={styles.field}>
              <T variant="label">Weekly goal</T>
              <T variant="small" tone="textMuted">
                Days a week you want to train. Your squad sees it with your days this week. It doesn&apos;t change your points.
              </T>
            </View>
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
            {feedback("goal")}
            <ListGroup>
              <ListRow
                title="Home time zone"
                subtitle="Decides which day a workout counts for. It can change once a week."
                value={settings.homeTimezone ?? "Not set"}
              />
            </ListGroup>
            {phoneZone && phoneZone !== settings.homeTimezone && (
              <Button
                label={`Use this phone's time zone (${phoneZone})`}
                variant="secondary"
                busy={saving === "tz"}
                onPress={() => save("tz", () => settingsApi.setHomeTimezone(phoneZone), "Time zone saved.")}
              />
            )}
            {feedback("tz")}
          </View>

          {Platform.OS === "ios" && health.available && (
            <View style={styles.section}>
              <SectionHeader title="Apple Health" />
              <Card>
                <Badge label={health.connected ? "Connected" : "Not connected"} tone={health.connected ? "success" : "neutral"} />
                <T variant="small" tone="textMuted">
                  {health.connected
                    ? "After a workout, Squad Six looks for a matching workout from your watch or another app and attaches it as evidence. It reads workouts and heart rate only and never writes anything. To stop, turn off access in the Health app → Sharing → Apps → Squad Six."
                    : "Wore a watch or used another fitness app? Connect Apple Health and matching workouts are attached as evidence. Squad Six reads workouts and heart rate only and never writes anything."}
                </T>
                {!health.connected && <Button label="Connect Apple Health" variant="secondary" onPress={() => void connectAppleHealth()} />}
              </Card>
            </View>
          )}

          <View style={styles.section}>
            <SectionHeader title="Rankings" />
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <T variant="label" nativeID="rankings-label">
                  Show me on the People rankings
                </T>
                <T variant="small" tone="textMuted">
                  {settings.hideFromRankings
                    ? "You're hidden: others don't see you on the People board. Your points still count, and your squad still ranks."
                    : "Others see your name, city and points on the People board. Turn this off to stay off it; your points still count."}
                </T>
              </View>
              <Switch
                accessibilityLabelledBy="rankings-label"
                accessibilityLabel="Show me on the People rankings"
                value={!settings.hideFromRankings}
                disabled={saving === "rankings"}
                trackColor={{ true: t.color.accent, false: t.color.track }}
                onValueChange={(show) =>
                  save("rankings", () => settingsApi.setHideFromRankings(userId, !show), show ? "You're back on the People rankings." : "You're hidden from the People rankings.")
                }
              />
            </View>
            {feedback("rankings")}
          </View>

          {appearance && (
            <View style={styles.section}>
              <SectionHeader title="Appearance" subtitle="System follows your phone's light or dark setting." />
              <Segmented
                label="Appearance"
                options={APPEARANCE_CHOICES}
                value={appearance}
                onChange={(choice) => {
                  setAppearanceChoice(choice);
                  void setAppearance(choice);
                }}
              />
            </View>
          )}

        </>
      )}

      {/* Always available, even when the rest of Settings cannot load (offline, or a server problem):
          nobody should be stuck signed in. */}
      <View style={styles.section}>
        <SectionHeader title="Account" />
        <ListGroup>
          <ListRow title="Email" value={session?.user.email ?? settings?.email ?? "–"} />
        </ListGroup>
        {/* Only accounts that sign in with email have a password to change. */}
        {session?.user.identities?.some((i) => i.provider === "email") && <ChangePassword />}
        <Button label="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
        <Button label="Delete account" variant="destructiveGhost" busy={saving === "delete"} onPress={confirmDelete} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="About" />
        {website && (
          <ListGroup>
            <ListRow title="Privacy policy" chevron onPress={() => Linking.openURL(`${website}/privacy`)} />
            <ListRow title="Terms of use" chevron onPress={() => Linking.openURL(`${website}/terms`)} />
            <ListRow title="Help and support" chevron onPress={() => Linking.openURL(`${website}/support`)} />
          </ListGroup>
        )}
        <T variant="caption" tone="textMuted">
          Squad Six {Constants.expoConfig?.version ?? ""}. City data © GeoNames (geonames.org), CC BY 4.0.
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: minTouch },
  switchText: { flex: 1, gap: space.xxs },
  section: { gap: layout.stackGap },
  field: { gap: space.xs },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});

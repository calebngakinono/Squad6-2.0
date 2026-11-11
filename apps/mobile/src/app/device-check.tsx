import * as Location from "expo-location";
import { Stack } from "expo-router";
import { Pedometer } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import { Platform, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { summarizeGps } from "@/spike/gps-summary";
import { runHealthKitCheck, type HealthKitResult } from "@/spike/healthkit-check";
import {
  clearRecordedPoints,
  DEVICE_CHECK_LOCATION_TASK,
  getRecordedPoints,
  subscribeToPoints,
} from "@/spike/location-task";
import { formatReport } from "@/spike/report";
import { space, type } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

// Development-only screen for the phase-1 device spike. It measures what the phone really delivers
// (GPS in background, steps, Apple Health) so we stop guessing. Nothing here is uploaded.
export default function DeviceCheckScreen() {
  const c = usePalette();
  const [pointCount, setPointCount] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [perm, setPerm] = useState({ foreground: "not asked", background: "not asked" });
  const [motion, setMotion] = useState({
    available: null as boolean | null,
    permission: "not asked",
    stepsDuringTest: null as number | null,
    stepsLastHour: null as number | null,
  });
  const stepSub = useRef<{ remove(): void } | null>(null);
  const [hk, setHk] = useState<HealthKitResult | null>(null);
  const [hkBusy, setHkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The points array is mutated in place, so re-render on every new point.
  useEffect(() => subscribeToPoints(() => setPointCount(getRecordedPoints().length)), []);
  useEffect(() => {
    Location.hasStartedLocationUpdatesAsync(DEVICE_CHECK_LOCATION_TASK).then(setTracking).catch(() => {});
    return () => stepSub.current?.remove();
  }, []);

  const summary = pointCount > 0 ? summarizeGps(getRecordedPoints()) : null;

  async function startGps() {
    setError(null);
    const fg = await Location.requestForegroundPermissionsAsync();
    const bg = fg.granted ? await Location.requestBackgroundPermissionsAsync() : null;
    setPerm({ foreground: fg.status, background: bg?.status ?? "not asked" });
    if (!fg.granted) {
      setError("Location permission is needed for the GPS test.");
      return;
    }

    const available = await Pedometer.isAvailableAsync();
    const pedPerm = available ? await Pedometer.requestPermissionsAsync() : null;
    setMotion((m) => ({ ...m, available, permission: pedPerm?.status ?? "unavailable", stepsDuringTest: 0 }));
    if (pedPerm?.granted) {
      stepSub.current = Pedometer.watchStepCount((r) => setMotion((m) => ({ ...m, stepsDuringTest: r.steps })));
    }

    clearRecordedPoints();
    await Location.startLocationUpdatesAsync(DEVICE_CHECK_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      activityType: Location.ActivityType.Fitness,
      timeInterval: 1000,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Squad Six device check",
        notificationBody: "Measuring GPS for the test. Stop it in the app.",
      },
    });
    setTracking(true);
  }

  async function stopGps() {
    await Location.stopLocationUpdatesAsync(DEVICE_CHECK_LOCATION_TASK);
    stepSub.current?.remove();
    stepSub.current = null;
    setTracking(false);
    if (Platform.OS === "ios" && motion.permission === "granted") {
      const now = new Date();
      const r = await Pedometer.getStepCountAsync(new Date(now.getTime() - 60 * 60 * 1000), now).catch(() => null);
      setMotion((m) => ({ ...m, stepsLastHour: r?.steps ?? null }));
    }
  }

  async function checkHealth() {
    setHkBusy(true);
    setHk(await runHealthKitCheck());
    setHkBusy(false);
  }

  const report = formatReport({
    platform: `${Platform.OS} ${Platform.Version}`,
    generatedAt: new Date().toISOString(),
    location: { ...perm, summary },
    motion,
    healthKit: hk,
  });

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.screen, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: true, title: "Device check" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="1. GPS and steps" c={c}>
          <Text style={[type.small, { color: c.textMuted }]}>
            Start, then walk outside for 5 minutes. Halfway, lock the phone for 2 minutes and keep walking. Allow
            location &quot;Always&quot; if asked.
          </Text>
          {tracking ? (
            <Button label="Stop GPS test" onPress={stopGps} />
          ) : (
            <Button label="Start GPS test" onPress={startGps} />
          )}
        </Section>

        {Platform.OS === "ios" && (
          <Section title="2. Apple Health" c={c}>
            <Text style={[type.small, { color: c.textMuted }]}>
              Reads your last 10 workouts and the heart rate of the latest one. Best after a workout recorded
              with your Apple Watch or another fitness app.
            </Text>
            <Button label="Check Apple Health" onPress={checkHealth} busy={hkBusy} variant="secondary" />
          </Section>
        )}

        {error && <Text style={[type.small, { color: c.danger }]}>{error}</Text>}

        <Section title="Report" c={c}>
          <Text selectable style={[type.small, { color: c.text, fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }) }]}>
            {report}
          </Text>
          <Button label="Share report" variant="secondary" onPress={() => Share.share({ message: report })} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, c, children }: { title: string; c: { text: string }; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[type.label, { color: c.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space.lg, gap: space.xl },
  section: { gap: space.md },
});

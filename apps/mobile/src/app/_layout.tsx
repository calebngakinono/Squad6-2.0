import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { OnboardingStatusProvider, useOnboardingStatus } from "@/features/onboarding/status";
import { SessionProvider, useSession } from "@/lib/session";
// Register the background location tasks at startup (required by expo-task-manager).
import "@/features/workout/tracking/device";
import "@/spike/location-task";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useSession();
  const { status } = useOnboardingStatus();
  const signedIn = !!session;
  // While signed in, wait for the onboarding check so the wrong screen never flashes.
  const ready = !loading && (!signedIn || status !== "loading");

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  // If the onboarding check failed (e.g. offline), fall back to the app rather than blocking it.
  const needsOnboarding = signedIn && status === "needed";

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn && !needsOnboarding}>
        <Stack.Screen name="index" />
        <Stack.Screen name="create-squad" />
        <Stack.Screen name="join" />
        <Stack.Screen name="start-workout" />
        <Stack.Screen name="workout" />
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="device-check" />
        </Stack.Protected>
      </Stack.Protected>
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <OnboardingStatusProvider>
        <StatusBar style="auto" />
        <RootNavigator />
      </OnboardingStatusProvider>
    </SessionProvider>
  );
}

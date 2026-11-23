// Per-weight imports, so only these six font files are bundled (each package index pulls in all 18).
import { BarlowCondensed_500Medium } from "@expo-google-fonts/barlow-condensed/500Medium";
import { BarlowCondensed_600SemiBold } from "@expo-google-fonts/barlow-condensed/600SemiBold";
import { BarlowCondensed_700Bold } from "@expo-google-fonts/barlow-condensed/700Bold";
import { Overpass_400Regular } from "@expo-google-fonts/overpass/400Regular";
import { Overpass_600SemiBold } from "@expo-google-fonts/overpass/600SemiBold";
import { Overpass_700Bold } from "@expo-google-fonts/overpass/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { ThemeProvider, useTheme } from "@/theme/theme";
import { useStackOptions } from "@/theme/navigation";
import { fontFaces } from "@/theme/tokens";
import { OnboardingStatusProvider, useOnboardingStatus } from "@/features/onboarding/status";
import { restoreAppearance } from "@/features/settings/appearance";
import { SessionProvider, useSession } from "@/lib/session";
// Register the background location tasks at startup (required by expo-task-manager).
import "@/features/workout/tracking/device";
import "@/spike/location-task";

SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsSettled, appearanceSettled }: { fontsSettled: boolean; appearanceSettled: boolean }) {
  const { session, loading } = useSession();
  const { status } = useOnboardingStatus();
  const t = useTheme();
  const stackOptions = useStackOptions();
  const signedIn = !!session;
  // While signed in, wait for the onboarding check so the wrong screen never flashes.
  // Also wait for the font (loaded or failed) so text never re-flows after the splash hides.
  // And for the saved Appearance setting, so the wrong light/dark look never flashes.
  const ready = fontsSettled && appearanceSettled && !loading && (!signedIn || status !== "loading");

  // The window behind every screen follows the theme, so transitions never flash white in dark mode.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.color.background).catch(() => {});
  }, [t.color.background]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  // If the onboarding check failed (e.g. offline), fall back to the app rather than blocking it.
  const needsOnboarding = signedIn && status === "needed";

  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Protected guard={signedIn && !needsOnboarding}>
        {/* The five tabs. Everything below opens over them, without the tab bar: a live workout
            needs the whole screen, and the others are short tasks with their own way back. */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create-squad" />
        <Stack.Screen name="join" />
        <Stack.Screen name="start-workout" />
        <Stack.Screen name="workout" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="past-workout/[id]" />
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="device-check" />
        </Stack.Protected>
      </Stack.Protected>
      {/* Onboarding comes first for new people and creates the account near its end. */}
      <Stack.Protected guard={!signedIn || needsOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // The brand font loads at runtime (no native rebuild). If it fails, the app uses the system font.
  const [fontsLoaded, fontError] = useFonts({
    [fontFaces.display["500"]]: BarlowCondensed_500Medium,
    [fontFaces.display["600"]]: BarlowCondensed_600SemiBold,
    [fontFaces.display["700"]]: BarlowCondensed_700Bold,
    [fontFaces.text["400"]]: Overpass_400Regular,
    [fontFaces.text["600"]]: Overpass_600SemiBold,
    [fontFaces.text["700"]]: Overpass_700Bold,
  });
  useEffect(() => {
    if (fontError) console.warn("Brand font failed to load; using the system font.", fontError);
  }, [fontError]);
  // Settings > Appearance (System, Light or Dark), saved on this phone.
  const [appearanceSettled, setAppearanceSettled] = useState(false);
  useEffect(() => {
    restoreAppearance().finally(() => setAppearanceSettled(true));
  }, []);

  return (
    <ThemeProvider fontsLoaded={fontsLoaded}>
      <SessionProvider>
        <OnboardingStatusProvider>
          <StatusBar style="auto" />
          <RootNavigator fontsSettled={fontsLoaded || !!fontError} appearanceSettled={appearanceSettled} />
        </OnboardingStatusProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

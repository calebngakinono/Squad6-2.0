import * as SecureStore from "expo-secure-store";
import { Appearance } from "react-native";
import { colorSchemeOverride, parseAppearance, type AppearanceChoice } from "./appearance-choice";

// Applies and remembers the Appearance setting on this phone. It is a per-device preference, not
// account data. Stored with expo-secure-store because it is already in the app (no new native module).
const KEY = "appearance";

/** Overrides light or dark for the whole app, native tab bar and alerts included. */
export function applyAppearance(choice: AppearanceChoice): void {
  Appearance.setColorScheme(colorSchemeOverride(choice));
}

/** Reads the saved choice and applies it. Falls back to following the phone. */
export async function restoreAppearance(): Promise<AppearanceChoice> {
  const choice = parseAppearance(await SecureStore.getItemAsync(KEY).catch(() => null));
  applyAppearance(choice);
  return choice;
}

/** Applies a new choice now and keeps it for next time. */
export async function setAppearance(choice: AppearanceChoice): Promise<void> {
  applyAppearance(choice);
  await SecureStore.setItemAsync(KEY, choice);
}

/** The saved choice, without applying it (for showing it in Settings). */
export async function loadAppearance(): Promise<AppearanceChoice> {
  return parseAppearance(await SecureStore.getItemAsync(KEY).catch(() => null));
}

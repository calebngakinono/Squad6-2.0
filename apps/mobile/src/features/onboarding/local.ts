import type { Answers } from "@squad-six/shared";
import Storage from "expo-sqlite/kv-store";
import { parseSavedProgress, type SavedProgress } from "./view";

// Onboarding runs before the account exists, so progress is kept on the phone until sign-up, then
// saved to the account with complete_onboarding(). Answers are not secret (goal, city, name), so the
// app's own SQLite key-value store is enough; the session stays in the keychain.

const KEY = "squadsix.onboarding.v1";

export async function readProgress(flowVersion: number): Promise<SavedProgress | null> {
  try {
    return parseSavedProgress(await Storage.getItem(KEY), flowVersion);
  } catch {
    return null;
  }
}

export async function writeProgress(flowVersion: number, stepId: string, answers: Answers): Promise<void> {
  const value: SavedProgress = { flowVersion, stepId, answers };
  await Storage.setItem(KEY, JSON.stringify(value)).catch(() => {});
}

export async function clearProgress(): Promise<void> {
  await Storage.removeItem(KEY).catch(() => {});
}

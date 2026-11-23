// The Appearance setting: follow the phone, or always light, or always dark. Pure, so it is
// unit-tested; appearance.ts applies and stores it.

export type AppearanceChoice = "system" | "light" | "dark";

export const APPEARANCE_CHOICES: { value: AppearanceChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** A stored value, or "system" when there is none or it is unknown. */
export function parseAppearance(raw: string | null | undefined): AppearanceChoice {
  return raw === "light" || raw === "dark" ? raw : "system";
}

/** What React Native's Appearance.setColorScheme takes: "unspecified" follows the phone again. */
export function colorSchemeOverride(choice: AppearanceChoice): "light" | "dark" | "unspecified" {
  return choice === "system" ? "unspecified" : choice;
}

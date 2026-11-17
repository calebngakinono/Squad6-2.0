import { parseSupabasePublicConfig, type SupabasePublicConfig } from "@squad-six/shared";

// EXPO_PUBLIC_* values are inlined into the app bundle at build time, so they must be referenced
// literally and must never hold a secret.
export function getSupabaseConfig(): SupabasePublicConfig {
  return parseSupabasePublicConfig(
    {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    },
    { url: "EXPO_PUBLIC_SUPABASE_URL", publishableKey: "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" },
  );
}

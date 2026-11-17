import { parseSupabasePublicConfig } from "@squad-six/shared";

// Only NEXT_PUBLIC_* values belong here: Next.js inlines them into the browser bundle.
// Server-only secrets get their own schema when a feature first needs one.
export type PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
};

// Next.js only inlines NEXT_PUBLIC_* when referenced literally, so list each key by name.
export function getPublicEnv(
  source: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): PublicEnv {
  const config = parseSupabasePublicConfig(
    { url: source.NEXT_PUBLIC_SUPABASE_URL, publishableKey: source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    { url: "NEXT_PUBLIC_SUPABASE_URL", publishableKey: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" },
  );
  return {
    NEXT_PUBLIC_SUPABASE_URL: config.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
  };
}

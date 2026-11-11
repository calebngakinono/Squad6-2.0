import { z } from "zod";

// The two public values every client needs to reach Supabase. Each app reads them from its own
// environment (NEXT_PUBLIC_* on web, EXPO_PUBLIC_* on mobile) and validates them with this schema.
// The publishable key is safe to ship to devices; the secret key never goes through here.
export const supabasePublicConfigSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(1),
});

export type SupabasePublicConfig = z.infer<typeof supabasePublicConfigSchema>;

/**
 * Validates the public Supabase config. `names` maps each field to the app's own variable name,
 * so the error tells the developer exactly which variable to set. Values are never echoed.
 */
export function parseSupabasePublicConfig(
  values: { url: string | undefined; publishableKey: string | undefined },
  names: { url: string; publishableKey: string },
): SupabasePublicConfig {
  const result = supabasePublicConfigSchema.safeParse(values);
  if (!result.success) {
    const keys = result.error.issues
      .map((issue) => names[issue.path[0] as keyof typeof names])
      .join(", ");
    throw new Error(`Missing or invalid environment variables: ${keys}`);
  }
  return result.data;
}

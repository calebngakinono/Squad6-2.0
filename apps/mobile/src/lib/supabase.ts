import type { Database } from "@squad-six/shared";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { createChunkedStorage } from "./chunked-storage";
import { getSupabaseConfig } from "./env";

const config = getSupabaseConfig();

export const supabase = createClient<Database>(config.url, config.publishableKey, {
  auth: {
    storage: createChunkedStorage(SecureStore),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground (Supabase's guidance for React Native).
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

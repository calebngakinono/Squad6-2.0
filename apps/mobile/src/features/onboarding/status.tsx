import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Status = "loading" | "needed" | "done" | "error";
type Ctx = { status: Status; refresh: () => Promise<void> };

const OnboardingStatusContext = createContext<Ctx>({ status: "loading", refresh: async () => {} });

// Whether the signed-in athlete still has to go through onboarding. The root navigator uses it to
// decide which screens exist.
export function OnboardingStatusProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id;
  // Remount per account, so a new sign-in never sees the previous account's status.
  return (
    <StatusForUser key={userId ?? "signed-out"} userId={userId}>
      {children}
    </StatusForUser>
  );
}

function StatusForUser({ userId, children }: { userId: string | undefined; children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("profile_private")
      .select("onboarding_completed_at")
      .eq("user_id", userId)
      .single();
    if (error) setStatus("error");
    else setStatus(data.onboarding_completed_at ? "done" : "needed");
  }, [userId]);

  useEffect(() => {
    let active = true;
    if (!userId) return;
    supabase
      .from("profile_private")
      .select("onboarding_completed_at")
      .eq("user_id", userId)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setStatus("error");
        else setStatus(data.onboarding_completed_at ? "done" : "needed");
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return <OnboardingStatusContext.Provider value={{ status, refresh }}>{children}</OnboardingStatusContext.Provider>;
}

export const useOnboardingStatus = () => useContext(OnboardingStatusContext);

// File: features/account/api.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

export type AccountStatus = "pending" | "approved" | "declined" | "suspended";
export type AccountAccess = { gateEnabled: boolean; accountStatus: AccountStatus; canAccess: boolean };

// Mirrors web's useAccountAccess (Incubation Account Review gate). When the gate flag is on, only "approved" accounts get into the app.
export function useAccountAccess() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["account-access", user?.id],
    enabled: !!user,
    // Short staleTime so an admin approving the account (or flipping the gate) shows up soon after the app returns to the foreground.
    staleTime: 15_000,
    queryFn: async (): Promise<AccountAccess> => {
      const [{ data: flagRow, error: flagError }, { data: profile, error: profileError }] = await Promise.all([
        supabase.from("feature_flags").select("enabled").eq("key", "incubation_review_gate_enabled").maybeSingle(),
        supabase.from("profiles").select("account_status").eq("id", user!.id).single(),
      ]);
      // Fail closed on a genuine error. A missing flag ROW (no error) means the gate was never configured, i.e. not enforced.
      if (flagError) throw flagError;
      if (profileError) throw profileError;
      const gateEnabled = flagRow?.enabled ?? false;
      const accountStatus = (profile?.account_status ?? "approved") as AccountStatus;
      return { gateEnabled, accountStatus, canAccess: gateEnabled ? accountStatus === "approved" : true };
    },
  });
}

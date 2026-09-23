import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { listSavedAccounts, removeSavedAccount as removeSavedAccountFromStorage, saveAccount, updateSavedAccountTokens, type SavedAccount } from "@/lib/account-sessions";

export type { SavedAccount } from "@/lib/account-sessions";

// Errors that genuinely mean "this refresh token is dead, there is no path
// back" — matched loosely since Supabase's exact wording has drifted across
// versions. Mirrors web's TERMINAL_AUTH_ERROR_PATTERNS.
const TERMINAL_AUTH_ERROR_PATTERNS = [
  "invalid refresh token",
  "refresh token not found",
  "refresh token already used",
  "session not found",
  "jwt expired",
];

function isTerminalAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return TERMINAL_AUTH_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}

/** The device's saved-account list, re-read after anything that could change it. */
export function useSavedAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);

  const refresh = useCallback(() => {
    void listSavedAccounts().then(setAccounts);
  }, []);

  useEffect(() => {
    refresh();
  }, [user?.id, refresh]);

  return { accounts, refresh };
}

/**
 * Swaps the live Supabase session to a saved account's cached tokens — no
 * re-entering a password. AuthProvider's onAuthStateChange listener picks up
 * the swap automatically and reloads session/user/profile from it.
 */
export function useSwitchAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (account: SavedAccount) => {
      const { data: currentSessionData } = await supabase.auth.getSession();
      const previousSession = currentSessionData.session;
      if (previousSession && previousSession.user.id !== account.user_id) {
        await updateSavedAccountTokens(previousSession.user.id, {
          access_token: previousSession.access_token,
          refresh_token: previousSession.refresh_token,
        });
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: account.access_token,
        refresh_token: account.refresh_token,
      });
      if (error) {
        if (isTerminalAuthError(error.message)) {
          await removeSavedAccountFromStorage(account.user_id);
          throw new Error(`Your session for ${account.display_name} has expired — sign in again to switch to it.`);
        }
        throw new Error(`Couldn't switch to ${account.display_name} right now — check your connection and try again.`);
      }

      if (data.session) {
        await saveAccount({ ...account, access_token: data.session.access_token, refresh_token: data.session.refresh_token });
      }
    },
    onSuccess: () => { queryClient.clear(); },
  });
}

export function useRemoveSavedAccount() {
  return useMutation({
    mutationFn: async (userId: string) => { await removeSavedAccountFromStorage(userId); },
  });
}

type AddAccountInput = { email: string; password: string };

/**
 * Signs into a SECOND personal account: snapshots both it and whoever was
 * active a moment ago into the saved-accounts cache, links them server-side,
 * and leaves the newly-added account active — matching web's useAddAccount.
 */
export function useAddAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password }: AddAccountInput) => {
      const { data: currentSessionData } = await supabase.auth.getSession();
      const previousSession = currentSessionData.session;

      if (previousSession) {
        const { data: previousProfile } = await supabase.from("profiles").select("id, username, display_name, avatar_url").eq("id", previousSession.user.id).single();
        if (previousProfile) {
          await saveAccount({
            user_id: previousProfile.id, username: previousProfile.username, display_name: previousProfile.display_name, avatar_url: previousProfile.avatar_url,
            access_token: previousSession.access_token, refresh_token: previousSession.refresh_token,
          });
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!data.session) throw new Error("Sign-in didn't return a session.");
      if (previousSession && data.user.id === previousSession.user.id) throw new Error("That's already your current account.");

      const { data: newProfile, error: profileError } = await supabase.from("profiles").select("id, username, display_name, avatar_url").eq("id", data.user.id).single();
      if (profileError || !newProfile) throw new Error("Couldn't load that account's profile.");

      await saveAccount({
        user_id: newProfile.id, username: newProfile.username, display_name: newProfile.display_name, avatar_url: newProfile.avatar_url,
        access_token: data.session.access_token, refresh_token: data.session.refresh_token,
      });

      // Best-effort — the switcher still works on this device even if this fails.
      if (previousSession) await supabase.rpc("link_accounts", { p_other_user_id: previousSession.user.id });

      return newProfile;
    },
    onSuccess: () => { queryClient.clear(); },
  });
}

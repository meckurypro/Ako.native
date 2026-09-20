// File: hooks/useAccountSwitcher.ts
//
// Converted from web. Main structural change: every accountSessions.ts
// call is now async (AsyncStorage vs localStorage) — see that file's
// header comment. Two places needed real restructuring beyond adding
// `await`, flagged inline below.
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import {
  listSavedAccounts,
  removeSavedAccount as removeSavedAccountFromStorage,
  saveAccount,
  updateSavedAccountTokens,
  type SavedAccount,
} from "../lib/accountSessions";

export function useSavedAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);

  // FLAG: web initialized state synchronously — useState(() =>
  // listSavedAccounts()) — because localStorage reads are sync.
  // AsyncStorage reads aren't, so this is now an async refresh in an
  // effect instead. Net effect: `accounts` is `[]` for one render on
  // mount before the real list loads, where web had it immediately.
  // If any caller assumes accounts is populated on first render,
  // that assumption no longer holds here.
  async function refresh() {
    setAccounts(await listSavedAccounts());
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { accounts, refresh };
}

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
          throw new Error(
            `Your session for ${account.display_name} has expired — sign in again to switch to it.`
          );
        }
        throw new Error(
          `Couldn't switch to ${account.display_name} right now — check your connection and try again.`
        );
      }

      if (data.session) {
        await saveAccount({
          ...account,
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useRemoveSavedAccount() {
  return useMutation({
    mutationFn: async (userId: string) => {
      await removeSavedAccountFromStorage(userId);
    },
  });
}

interface AddAccountInput {
  email: string;
  password: string;
}

export function useAddAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password }: AddAccountInput) => {
      const { data: currentSessionData } = await supabase.auth.getSession();
      const previousSession = currentSessionData.session;

      if (previousSession) {
        const { data: previousProfile } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", previousSession.user.id)
          .single();
        if (previousProfile) {
          await saveAccount({
            user_id: previousProfile.id,
            username: previousProfile.username,
            display_name: previousProfile.display_name,
            avatar_url: previousProfile.avatar_url,
            access_token: previousSession.access_token,
            refresh_token: previousSession.refresh_token,
          });
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error("Sign-in didn't return a session.");

      if (previousSession && data.user.id === previousSession.user.id) {
        throw new Error("That's already your current account.");
      }

      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", data.user.id)
        .single();
      if (profileError || !newProfile) throw new Error("Couldn't load that account's profile.");

      await saveAccount({
        user_id: newProfile.id,
        username: newProfile.username,
        display_name: newProfile.display_name,
        avatar_url: newProfile.avatar_url,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      // FLAG: web called this RPC unconditionally best-effort, not
      // awaited-and-checked. Kept identical here — same trust model,
      // just noting native has no different treatment of network
      // flakiness than web did, which may be worth revisiting given
      // mobile networks drop more often than desktop wifi.
      if (previousSession) {
        await supabase.rpc("link_accounts", { p_other_user_id: previousSession.user.id });
      }

      return newProfile;
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

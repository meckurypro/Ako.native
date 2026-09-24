// File: features/notifications/pushToken.ts
// Server-side bookkeeping for this device's Expo push token. Lives apart from push.ts (which is a
// React hook module that imports AuthProvider) so AuthProvider can call unregisterPushToken() on
// sign-out without an import cycle.
//
// Why this exists: push_tokens.token is UNIQUE and its UPDATE policy only lets a user touch their
// own rows. A plain upsert therefore fails (RLS) when this device's token is still owned by the
// account that used it before — i.e. after any sign-out or account switch — and the failure was only
// a console.warn, which leaves the new account with no token and no pushes.
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";

export function getEasProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Points `token` at `userId`. Prefers the register_push_token RPC (SECURITY DEFINER, so it can
 * re-home a token from another account); if that migration isn't applied yet, falls back to the
 * plain upsert, which works for first registration and the same account re-registering.
 */
export async function saveTokenRow(token: string, userId: string): Promise<void> {
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const rpc = await supabase.rpc("register_push_token", { p_token: token, p_platform: platform });
  if (!rpc.error) return;
  // PGRST202 = function not found (migration not applied yet); anything else is a real failure worth surfacing.
  if (rpc.error.code !== "PGRST202") {
    console.warn("register_push_token failed", rpc.error);
  }
  const { error } = await supabase
    .from("push_tokens")
    .upsert({ token, user_id: userId, platform, last_seen_at: new Date().toISOString() }, { onConflict: "token" });
  if (error) console.warn("push token upsert failed (token may still belong to another account)", error);
}

/**
 * Removes this device's token row. Called on sign-out, while the session is still valid, so the next
 * account to sign in on this device starts clean. Best-effort and time-boxed: sign-out must never
 * wait on the network, and the register RPC covers the case where this doesn't get to run.
 */
export async function unregisterPushToken(timeoutMs = 3000): Promise<void> {
  if (Platform.OS === "web") return;
  const projectId = getEasProjectId();
  if (!projectId) return;
  const work = (async () => {
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) return; // never had a token on this device
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from("push_tokens").delete().eq("token", token);
  })();
  try {
    await Promise.race([work, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
  } catch { /* best-effort */ }
}

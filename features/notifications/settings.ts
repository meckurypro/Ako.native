// File: features/notifications/settings.ts
//
// features/notifications/push.ts silently requests OS permission and
// registers an Expo push token on every app launch/foreground once someone
// is signed in (no toggle involved). This file adds the explicit "turn
// these off" control for Settings: the opted-out flag it writes is read by
// registerToken() before it does anything, so switching this off actually
// stops re-registration and clears the person's existing token(s) — not
// just a UI toggle with no effect on the real push pipeline.
//
// Default (no stored flag yet) is "not opted out", since most people will
// never open this screen at all — they'll just get the automatic OS prompt
// from push.ts and grant it. The toggle here reflects OS-granted AND
// not-opted-out, and mainly gives people a way to (a) see current status,
// (b) retry with our own rationale/blocked-Settings copy if they dismissed
// the silent one, and (c) mute pushes without touching OS Settings.
import { useCallback, useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { ensurePermission } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

const OPTED_OUT_KEY = "ako-notifications-opted-out";

export async function isNotificationsOptedOut(): Promise<boolean> {
  return (await SecureStore.getItemAsync(OPTED_OUT_KEY)) === "true";
}

async function setOptedOut(value: boolean, userId: string | undefined) {
  await SecureStore.setItemAsync(OPTED_OUT_KEY, String(value));
  if (value && userId) {
    // Stop sending this person pushes immediately rather than waiting for
    // Expo to report the token stale — best-effort, never blocks the toggle.
    try { await supabase.from("push_tokens").delete().eq("user_id", userId); } catch { /* best-effort */ }
  }
}

export function useNotificationSettings(userId: string | undefined) {
  const [enabled, setEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [optedOut, current] = await Promise.all([isNotificationsOptedOut(), Notifications.getPermissionsAsync()]);
      if (!alive) return;
      setEnabledState(current.granted && !optedOut);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const setEnabled = useCallback(async (value: boolean) => {
    if (!value) {
      setEnabledState(false);
      await setOptedOut(true, userId);
      return;
    }
    // Turning on goes through the shared rationale/blocked flow — push.ts's
    // own silent request may have already been declined, so this gives
    // people a second, more informative path (and a Settings deep-link if
    // it's now OS-blocked) rather than nothing happening on tap.
    const granted = await ensurePermission("notifications");
    if (granted) await setOptedOut(false, userId);
    setEnabledState(granted);
  }, [userId]);

  return { enabled, loading, setEnabled };
}

// File: features/notifications/push.ts
// Client half of item 8 — Expo push token registration and the
// foreground/tap handlers. The server half is
// supabase/functions/send-message-push, invoked from
// features/messaging/api.ts and lib/outbox.ts right after a message
// insert succeeds.
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { isNotificationsOptedOut } from "./settings";

// Foreground notifications still show a banner/sound — without this handler
// Expo suppresses them entirely while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerToken(userId: string) {
  if (Platform.OS === "web") return; // push_tokens.platform is constrained to ios/android; no push support on web anyway
  if (await isNotificationsOptedOut()) return; // explicit "off" from Settings (features/notifications/settings.ts) — don't silently re-register
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", { name: "Default", importance: Notifications.AndroidImportance.DEFAULT });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) { console.warn("registerToken: no EAS projectId in app config, skipping"); return; }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    // Upsert on `token` (not `user_id`) so a device that switches accounts hands its
    // token to whoever is signed in now, rather than accumulating stale rows per device.
    const { error } = await supabase
      .from("push_tokens")
      .upsert({ token, user_id: userId, platform: Platform.OS, last_seen_at: new Date().toISOString() }, { onConflict: "token" });
    if (error) console.warn("push token upsert failed", error);
  } catch (error) {
    // Expected on simulators/emulators (no push capability) and occasionally right
    // after a fresh install before the OS has finished provisioning; not fatal.
    console.warn("push token registration skipped", error);
  }
}

/** Registers (or re-registers) this device's push token whenever a user is signed in, and on every foreground — cheap no-op if the token and row are already current, but catches the token Expo occasionally rotates. Mount once, near the root, inside AuthProvider. */
export function usePushRegistration() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    void registerToken(user.id);
    const sub = AppState.addEventListener("change", (state) => { if (state === "active") void registerToken(user.id); });
    return () => sub.remove();
  }, [user?.id]);

  // Cold start: the listener below only sees taps that happen while the app process is alive, so a
  // notification that *launched* the app from closed has to be read back once, after sign-in
  // (navigating any earlier would race the root layout mounting).
  const handledColdStart = useRef(false);
  useEffect(() => {
    if (!user || handledColdStart.current) return;
    handledColdStart.current = true;
    const response = Notifications.getLastNotificationResponse();
    const data = response?.notification.request.content.data as { conversationId?: string } | undefined;
    if (!data?.conversationId) return;
    Notifications.clearLastNotificationResponse();
    router.push({ pathname: "/messages/[conversationId]", params: { conversationId: data.conversationId } });
  }, [user, router]);

  // Tapping a notification while the app is running (foreground or backgrounded) deep-links into the
  // conversation it was about, matching what tapping the same message would do in-app.
  const routerRef = useRef(router);
  routerRef.current = router;
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { conversationId?: string } | undefined;
      if (data?.conversationId) routerRef.current.push({ pathname: "/messages/[conversationId]", params: { conversationId: data.conversationId } });
    });
    return () => sub.remove();
  }, []);
}

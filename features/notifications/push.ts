// File: features/notifications/push.ts
// Client half of item 8 — Expo push token registration and the
// foreground/tap handlers. The server half is
// supabase/functions/send-message-push, invoked from
// features/messaging/api.ts and lib/outbox.ts right after a message
// insert succeeds.
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { File, Paths } from "expo-file-system";
import { ensurePermission } from "@/lib/permissions";
import { useAuth } from "@/providers/AuthProvider";
import { isNotificationsOptedOut } from "./settings";
import { getEasProjectId, saveTokenRow } from "./pushToken";

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

// The rationale-then-OS-prompt flow runs at most once per install. The marker lives in the app's
// document directory (removed on uninstall) rather than SecureStore, whose iOS keychain entries
// survive a reinstall and would suppress the prompt on a fresh install where the OS has forgotten it.
// After this, Settings > Notifications (features/notifications/settings.ts) is the retry path.
const PROMPTED_MARKER = new File(Paths.document, "push-permission-prompted");

function markPrompted() {
  try {
    PROMPTED_MARKER.create({ overwrite: true });
  } catch { /* if this fails we may ask once more next launch; harmless */ }
}

// Notification requests already routed, so one tap can never navigate twice.
const handledResponses = new Set<string>();

async function registerToken(userId: string) {
  if (Platform.OS === "web") return; // push_tokens.platform is constrained to ios/android; no push support on web anyway
  if (await isNotificationsOptedOut()) return; // explicit "off" from Settings (features/notifications/settings.ts) — don't silently re-register
  try {
    // Android 13+ only shows the permission prompt once a notification channel exists, so create it first.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", { name: "Default", importance: Notifications.AndroidImportance.DEFAULT });
    }

    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted) {
      // Ask (with our own rationale first, via ensurePermission) only while the OS will still show a
      // prompt and only once per install; a denied/blocked state is left alone rather than re-nagging
      // on every foreground.
      if (current.canAskAgain && !PROMPTED_MARKER.exists) {
        markPrompted();
        granted = await ensurePermission("notifications");
      }
    }
    if (!granted) return;

    const projectId = getEasProjectId();
    if (!projectId) { console.warn("registerToken: no EAS projectId in app config, skipping"); return; }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await saveTokenRow(token, userId);
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

  // Cold start: the live listener below only sees taps while the process is alive, so a notification
  // that *launched* the app from closed is read back once, after sign-in (navigating earlier would race
  // the root layout mounting). The biometric gate renders as an overlay above the navigator, so pushing
  // the route here doesn't bypass the lock: the conversation only becomes visible after unlock.
  const handledColdStart = useRef(false);
  useEffect(() => {
    if (!user || handledColdStart.current) return;
    handledColdStart.current = true;
    if (openConversationFromResponse(router, Notifications.getLastNotificationResponse())) Notifications.clearLastNotificationResponse();
  }, [user, router]);

  // Tapping a notification while the app is running (foreground or backgrounded) deep-links into the
  // conversation it was about. Ignored while signed out: there is no account to show that chat for.
  const signedIn = !!user;
  useEffect(() => {
    if (!signedIn) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => openConversationFromResponse(router, response));
    return () => sub.remove();
  }, [signedIn, router]);
}

// Both the cold-start read and the live listener can deliver the same tap (on some platforms the
// listener also fires for the notification that launched the app), so each response is handled at
// most once, keyed by the notification's request identifier.
function openConversationFromResponse(router: ReturnType<typeof useRouter>, response: Notifications.NotificationResponse | null | undefined): boolean {
  if (!response) return false;
  const id = response.notification.request.identifier;
  if (handledResponses.has(id)) return false;
  const data = response.notification.request.content.data as { conversationId?: string } | undefined;
  if (!data?.conversationId) return false;
  handledResponses.add(id);
  router.push({ pathname: "/messages/[conversationId]", params: { conversationId: data.conversationId } });
  return true;
}

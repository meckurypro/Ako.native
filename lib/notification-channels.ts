// File: lib/notification-channels.ts
// Android notification channels. On Android 8+ the *channel* owns a notification's sound, importance
// and vibration, and none of that can be changed once the channel exists on a device — so a channel id
// is effectively permanent: to change a sound, ship a new id, don't edit the old one.
//
// "messages" and "activity" match the channelId values the push functions can send (send-message-push,
// send-activity-push — see supabase/functions). "default" is kept as a fallback for any notification
// that doesn't set a channelId (and for older server deployments). The sound file names are exactly as
// bundled by the expo-notifications config plugin in app.config.ts (Android turns them into raw
// resource ids); see assets/sounds/README.md to replace them.
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export const CHANNEL_IDS = { default: "default", messages: "messages", activity: "activity" } as const;

let ensured: Promise<void> | null = null;

/**
 * Creates the channels (idempotent; a no-op off Android). Must run before the first notification
 * permission request on Android 13+, which won't show the prompt until a channel exists.
 */
export function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return Promise.resolve();
  ensured ??= (async () => {
    const { AndroidImportance } = Notifications;
    await Promise.all([
      Notifications.setNotificationChannelAsync(CHANNEL_IDS.default, { name: "Default", importance: AndroidImportance.DEFAULT }),
      Notifications.setNotificationChannelAsync(CHANNEL_IDS.messages, {
        name: "Messages",
        description: "New chat messages",
        importance: AndroidImportance.HIGH, // heads-up: a message is something you'd want to see immediately
        sound: "ako_message.wav",
        vibrationPattern: [0, 200, 120, 200],
      }),
      Notifications.setNotificationChannelAsync(CHANNEL_IDS.activity, {
        name: "Activity",
        description: "Follows, comments, gifts and other activity",
        importance: AndroidImportance.DEFAULT,
        sound: "ako_activity.wav",
      }),
    ]);
  })().catch((error) => {
    ensured = null; // let a later call retry
    throw error;
  });
  return ensured;
}

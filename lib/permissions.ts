// File: lib/permissions.ts
// Central place for runtime permission flows. Each kind knows how to check
// its current status, how to actually request it, and what rationale copy
// to show. `ensurePermission` always shows the rationale *before* the native
// prompt on first ask (Apple/Google best practice), and routes to Settings
// once the OS reports the permission as blocked ("denied" with canAskAgain
// false, the one state a re-request can't recover from).
import { Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import * as Calendar from "expo-calendar";
import { requestRecordingPermissionsAsync, getRecordingPermissionsAsync } from "expo-audio";

export type PermissionKind = "camera" | "mediaLibrary" | "microphone" | "notifications" | "calendar";

type PermissionResult = { granted: boolean; canAskAgain: boolean };

type Handler = {
  rationaleTitle: string;
  rationaleBody: string;
  blockedBody: string;
  get: () => Promise<PermissionResult>;
  request: () => Promise<PermissionResult>;
};

const handlers: Record<PermissionKind, Handler> = {
  camera: {
    rationaleTitle: "Allow camera access",
    rationaleBody: "AKọ uses your camera only when you choose to take a photo or video to share.",
    blockedBody: "Camera access is off for AKọ. Turn it on in Settings to take a photo or video.",
    get: () => ImagePicker.getCameraPermissionsAsync(),
    request: () => ImagePicker.requestCameraPermissionsAsync(),
  },
  mediaLibrary: {
    rationaleTitle: "Allow photo access",
    rationaleBody: "AKọ uses your photo library only when you choose media to share.",
    blockedBody: "Photo access is off for AKọ. Turn it on in Settings to choose media to share.",
    get: () => ImagePicker.getMediaLibraryPermissionsAsync(),
    request: () => ImagePicker.requestMediaLibraryPermissionsAsync(),
  },
  microphone: {
    rationaleTitle: "Allow microphone access",
    rationaleBody: "AKọ uses your microphone only when you choose to record a voice note or join a call.",
    blockedBody: "Microphone access is off for AKọ. Turn it on in Settings to record audio.",
    get: () => getRecordingPermissionsAsync(),
    request: () => requestRecordingPermissionsAsync(),
  },
  notifications: {
    rationaleTitle: "Turn on notifications",
    rationaleBody: "AKọ can let you know about new messages, gifts, and activity on your posts.",
    blockedBody: "Notifications are off for AKọ. Turn them on in Settings to hear about new activity.",
    get: () => Notifications.getPermissionsAsync(),
    request: () => Notifications.requestPermissionsAsync(),
  },
  calendar: {
    rationaleTitle: "Allow calendar access",
    rationaleBody: "AKọ accesses your calendar only when you choose to add an event to it.",
    blockedBody: "Calendar access is off for AKọ. Turn it on in Settings to add events to your calendar.",
    // The *Async permission helpers are throwing stubs in expo-calendar SDK 57; use the object API's.
    get: () => Calendar.getCalendarPermissions(),
    request: () => Calendar.requestCalendarPermissions(),
  },
};

function promptRationale(handler: Handler): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(handler.rationaleTitle, handler.rationaleBody, [
      { text: "Not now", style: "cancel", onPress: () => resolve(false) },
      { text: "Continue", onPress: () => resolve(true) },
    ]);
  });
}

function promptBlocked(handler: Handler): void {
  Alert.alert(handler.rationaleTitle, handler.blockedBody, [
    { text: "Not now", style: "cancel" },
    { text: "Open Settings", onPress: () => void Linking.openSettings() },
  ]);
}

/**
 * Ensures a permission is granted, walking through: already-granted
 * short-circuit -> rationale primer -> native request -> Settings redirect
 * if the OS reports the permission as blocked. Returns whether the
 * permission ended up granted; never throws.
 */
export async function ensurePermission(kind: PermissionKind): Promise<boolean> {
  const handler = handlers[kind];
  const current = await handler.get();
  if (current.granted) return true;

  if (!current.canAskAgain) {
    promptBlocked(handler);
    return false;
  }

  const proceed = await promptRationale(handler);
  if (!proceed) return false;

  const result = await handler.request();
  if (!result.granted && !result.canAskAgain) promptBlocked(handler);
  return result.granted;
}

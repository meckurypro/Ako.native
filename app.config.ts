import type { ExpoConfig, ConfigContext } from "expo/config";

const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME ?? "AKọ";
const APP_SCHEME = process.env.EXPO_PUBLIC_APP_SCHEME ?? "ako";
const IOS_BUNDLE_ID = process.env.EXPO_PUBLIC_IOS_BUNDLE_ID ?? "com.ako.app";
const ANDROID_PACKAGE = process.env.EXPO_PUBLIC_ANDROID_PACKAGE ?? "com.ako.app";
const EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "a52dfba5-d0f5-48f5-947d-a68b659b37a4";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: "ako",
  version: "1.0.0",
  orientation: "portrait",
  scheme: APP_SCHEME,
  userInterfaceStyle: "automatic",
  icon: "./assets/icons/app-icon.png",
  ios: {
    supportsTablet: true,
    bundleIdentifier: IOS_BUNDLE_ID,
    infoPlist: {
      NSCameraUsageDescription: "AKọ uses your camera only when you choose to create media.",
      NSMicrophoneUsageDescription: "AKọ uses your microphone only when you choose to record audio or join a call.",
      NSPhotoLibraryUsageDescription: "AKọ accesses your library only when you choose media to share.",
      NSFaceIDUsageDescription: "AKọ uses Face ID to unlock the app quickly and keep your account secure.",
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    softwareKeyboardLayoutMode: "resize",
    // The local database is encrypted with a key that lives in the Android Keystore, which is never
    // backed up. Auto Backup would restore the database file (and SecureStore's ciphertext) onto a
    // device that has no key for them, so opt out rather than rely on recovering from that.
    allowBackup: false,
    // Foreground/monochrome are a padded white wordmark on transparent (inside Android's 66dp safe circle, so no mask crops it);
    // the background is the icon's own dark green, the same colour as assets/icons/app-icon.png.
    adaptiveIcon: {
      foregroundImage: "./assets/icons/adaptive-icon.png",
      monochromeImage: "./assets/icons/adaptive-icon.png",
      backgroundColor: "#0B1A15",
    },
    predictiveBackGestureEnabled: true,
  },
  web: { favicon: "./assets/icons/app-icon.png" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    // SQLCipher: the local cache database is encrypted at rest (lib/db-encryption.ts). Needs a native
    // rebuild; Expo Go can't run it.
    ["expo-sqlite", { useSQLCipher: true }],
    "expo-font",
    "expo-asset",
    ["expo-image-picker", { "photosPermission": "Choose a photo to use as your AKọ profile image.", "cameraPermission": "Take a photo to use as your AKọ profile image.", "microphonePermission": false }],
    "expo-video",
    "expo-audio",
    [
      "expo-notifications",
      {
        // Android small icon: must be a flat white silhouette on transparent, or Android renders it as
        // a plain white square. 96x96 "k" cut from the wordmark — see assets/images.
        icon: "./assets/images/notification-icon.png",
        color: "#0B1A15",
        // Bundled into the iOS app and Android res/raw (names: lowercase/digits/underscores only, per
        // Android's raw-resource rules). Replace the files in assets/sounds (same names) to change the
        // sounds — see its README. Android also needs a channel that references them by name:
        // lib/notification-channels.ts, created before the first permission prompt.
        sounds: ["./assets/sounds/ako_message.wav", "./assets/sounds/ako_activity.wav"],
      },
    ],
    [
      "expo-local-authentication",
      { faceIDPermission: "AKọ uses Face ID to unlock the app quickly and keep your account secure." },
    ],
    [
      "expo-calendar",
      { calendarPermission: "AKọ accesses your calendar only when you choose to add an event, like a gig or a room meeting, to it." },
    ],
    [
      "expo-splash-screen",
      {
        // The native splash is background-only now: it renders before JS,
        // so it can only ever follow the *system* color scheme, never an
        // in-app "force dark/light" preference — see AppSplash's own
        // known-limitations note. Putting the brand mark here risked a
        // wrong-theme logo flash on exactly that mismatch, so all logo,
        // glow and motif rendering now lives entirely in AppSplash, which
        // waits for ThemeProvider to hydrate before it ever paints.
        // `image` is a fully transparent 200x200 placeholder (see
        // scripts/build-splash-assets.py) purely so Android 12+'s circular
        // splash-icon mask has nothing to crop; if a future SDK bump makes
        // the plugin reject a transparent image, omit `image` here entirely
        // rather than putting a real logo back.
        image: "./assets/images/splash-blank.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#F7F4EF", // lightColors.background (theme/tokens.ts)
        dark: {
          image: "./assets/images/splash-blank.png",
          backgroundColor: "#0C0C0B", // darkColors.background (theme/tokens.ts)
        },
      },
    ],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? "",
    termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? "",
    eas: { projectId: EAS_PROJECT_ID },
  },
});

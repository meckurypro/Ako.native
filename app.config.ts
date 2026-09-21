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
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    softwareKeyboardLayoutMode: "resize",
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
    "expo-font",
    "expo-asset",
    ["expo-image-picker", { "photosPermission": "Choose a photo to use as your AKọ profile image.", "cameraPermission": "Take a photo to use as your AKọ profile image.", "microphonePermission": false }],
    "expo-video",
    "expo-audio",
    [
      "expo-splash-screen",
      {
        // Light: the light-theme wordmark (dark green) on the light canvas; dark: the dark-theme wordmark (bright green)
        // on the dark canvas — the same pairing the in-app headers use (theme/wordmarks.ts). Backgrounds are the
        // theme's `background` tokens so the hand-off to AppSplash doesn't flash.
        image: "./assets/images/app-icon-light-without-tagline.png",
        imageWidth: 152,
        resizeMode: "contain",
        backgroundColor: "#F7F4EF",
        dark: {
          image: "./assets/images/app-icon-dark-without-tagline.png",
          backgroundColor: "#0C0C0B",
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

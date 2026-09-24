// File: components/security/PrivacyCover.tsx
// Opaque, brand-only screen drawn over the whole app. Used (1) while auth and the biometric
// setting are still loading on a cold start, so a locked app never paints one frame of chats
// before the lock engages, and (2) while the app is inactive/backgrounded with app-lock on, so the
// OS app-switcher snapshot shows the logo instead of conversations.
import { Image, StyleSheet, View } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";

const LOGO = {
  light: require("@/assets/images/splash-logo-light.png"),
  dark: require("@/assets/images/splash-logo-dark.png"),
} as const;
const LOGO_WIDTH = 200;

export function PrivacyCover() {
  const { colors, isDark } = useTheme();
  const source = LOGO[isDark ? "dark" : "light"];
  const meta = Image.resolveAssetSource(source);
  const height = LOGO_WIDTH * (meta.height / meta.width);
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.background }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={source} style={{ width: LOGO_WIDTH, height }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  // Above BiometricLockScreen (zIndex 50) and the offline banner.
  root: { alignItems: "center", justifyContent: "center", zIndex: 60 },
});

import { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Text } from "@/components/core";
import { useTheme } from "@/providers/ThemeProvider";
import { wordmarks } from "@/theme/wordmarks";

export function AppSplash({ ready, onFinished }: { ready: boolean; onFinished: () => void }) {
  const reduced = useReducedMotion(); const { colors, isDark } = useTheme(); const logo = useSharedValue(reduced ? 1 : 0.9); const opacity = useSharedValue(reduced ? 1 : 0); const shell = useSharedValue(1);
  useEffect(() => { logo.value = withTiming(1, { duration: reduced ? 0 : 260, easing: Easing.out(Easing.cubic) }); opacity.value = withTiming(1, { duration: reduced ? 0 : 220 }); }, [logo, opacity, reduced]);
  useEffect(() => { if (!ready) return; shell.value = withTiming(0, { duration: reduced ? 0 : 220 }, (finished) => { if (finished) scheduleOnRN(onFinished); }); }, [onFinished, ready, reduced, shell]);
  const logoStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: logo.value }] }));
  const shellStyle = useAnimatedStyle(() => ({ opacity: shell.value }));
  return <Animated.View accessibilityLabel="AKọ is starting" style={[StyleSheet.absoluteFill, styles.container, { backgroundColor: colors.background }, shellStyle]}><View style={[styles.glow, { backgroundColor: `${colors.accent}1A` }]} /><Animated.View style={[styles.brand, logoStyle]}><Image source={wordmarks[isDark ? "dark" : "light"]} resizeMode="contain" style={styles.logo} /><Text variant="caption" style={[styles.tagline, { color: colors.textSecondary }]}>Create. Connect. Grow.</Text></Animated.View></Animated.View>;
}
const styles = StyleSheet.create({ container: { zIndex: 1000, alignItems: "center", justifyContent: "center" }, brand: { alignItems: "center" }, // 152 wide = the native splash's imageWidth, so the hand-off from the OS splash doesn't jump.
  logo: { width: 152, height: 82 }, tagline: { marginTop: 12, letterSpacing: 1.1 }, glow: { position: "absolute", width: 240, height: 240, borderRadius: 120 } });

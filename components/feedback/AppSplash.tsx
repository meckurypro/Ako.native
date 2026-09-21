import { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Text } from "@/components/core";

export function AppSplash({ ready, onFinished }: { ready: boolean; onFinished: () => void }) {
  const reduced = useReducedMotion(); const logo = useSharedValue(reduced ? 1 : 0.9); const opacity = useSharedValue(reduced ? 1 : 0); const shell = useSharedValue(1);
  useEffect(() => { logo.value = withTiming(1, { duration: reduced ? 0 : 260, easing: Easing.out(Easing.cubic) }); opacity.value = withTiming(1, { duration: reduced ? 0 : 220 }); }, [logo, opacity, reduced]);
  useEffect(() => { if (!ready) return; shell.value = withTiming(0, { duration: reduced ? 0 : 220 }, (finished) => { if (finished) scheduleOnRN(onFinished); }); }, [onFinished, ready, reduced, shell]);
  const logoStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: logo.value }] }));
  const shellStyle = useAnimatedStyle(() => ({ opacity: shell.value }));
  return <Animated.View accessibilityLabel="AKọ is starting" style={[StyleSheet.absoluteFill, styles.container, shellStyle]}><View style={styles.glow} /><Animated.View style={[styles.brand, logoStyle]}><Image source={require("../../assets/images/splash-logo.png")} resizeMode="contain" style={styles.logo} /><Text variant="title" style={styles.wordmark}>AKọ</Text><Text variant="caption" style={styles.tagline}>Create. Connect. Grow.</Text></Animated.View></Animated.View>;
}
const styles = StyleSheet.create({ container: { zIndex: 1000, alignItems: "center", justifyContent: "center", backgroundColor: "#131311" }, brand: { alignItems: "center" }, logo: { width: 118, height: 118 }, wordmark: { color: "#F9F8F5", fontSize: 32, marginTop: 14, letterSpacing: -0.6 }, tagline: { color: "#ADA99E", marginTop: 6, letterSpacing: 1.1 }, glow: { position: "absolute", width: 240, height: 240, borderRadius: 120, backgroundColor: "rgba(76,174,124,0.10)" } });

import { useEffect } from "react";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "@/providers/ThemeProvider";
export function Skeleton({ width = "100%", height = 16, radius = 8 }: { width?: number | `${number}%`; height?: number; radius?: number }) {
  const { colors } = useTheme(); const opacity = useSharedValue(0.5); const reduced = useReducedMotion();
  useEffect(() => { if (!reduced) opacity.value = withRepeat(withTiming(0.9, { duration: 700 }), -1, true); }, [opacity, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View accessibilityLabel="Loading" style={[style, { width, height, borderRadius: radius, backgroundColor: colors.skeleton }]} />;
}

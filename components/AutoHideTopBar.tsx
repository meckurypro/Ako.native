// File: components/AutoHideTopBar.tsx
//
// Web: `sticky top-0 z-20` block in normal flow. RN has no sticky, so this
// is an absolutely-positioned overlay pinned to the top of the screen —
// content scrolls underneath it as blurred glass, exactly like web.
// Consequence: the screen must pad its scroller by the bar's height. Pass
// `onHeightChange` and use the value as the scroller's paddingTop (it
// already includes the top safe-area inset).
//
// Hides by sliding up + fading (300ms ease-out) on scroll-down and comes
// straight back on scroll-up — see hooks/useAutoHideOnScroll.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAutoHideOnScroll } from "../hooks/useAutoHideOnScroll";
import { useTheme, withAlpha } from "../lib/theme";

interface AutoHideTopBarProps {
  children: ReactNode;
  onHeightChange?: (height: number) => void;
}

// CSS `ease-out` == cubic-bezier(0, 0, 0.58, 1)
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

export function AutoHideTopBar({ children, onHeightChange }: AutoHideTopBarProps) {
  const visible = useAutoHideOnScroll();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 300,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  }, [visible, progress]);

  function handleLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height;
    setHeight(h);
    onHeightChange?.(h);
  }

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-height, 0],
  });

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[
        styles.bar,
        {
          paddingTop: insets.top,
          opacity: progress,
          transform: [{ translateY }],
          // web: 0 2px 8px -4px rgba(ink, 0.10) — RN has no spread, so
          // this is a close approximation.
          shadowColor: isDark ? "#000000" : "#1F1D1A",
          elevation: 2,
        },
      ]}
    >
      {/* bg-surface/80 + backdrop-blur-md */}
      <BlurView
        intensity={40}
        tint={isDark ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(colors.surface, 0.8) }]}
      />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});

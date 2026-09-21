// File: components/LoadingOverlay.tsx
//
// Mount once near the root, inside QueryClientProvider. Any mutation
// tagged `meta: { blocking: true }` (profile save, create/edit/delete
// post, ...) makes this appear and it disappears the instant that mutation
// settles — driven off react-query's in-flight count, no timer, no
// artificial minimum. Deliberately not for instant toggles (like, follow,
// bookmark) or chat sends.
//
// Rendered IN-TREE (an absolutely-positioned full-screen view), not as an
// RN <Modal>, on purpose: this typically starts the moment a ConfirmDialog
// or sheet's confirm button fires, while that <Modal> is still dismissing —
// and iOS silently refuses to present a second <Modal> during that window,
// so a Modal-based spinner would just never show. The trade-off: it draws
// above the app, BottomNav and toasts, but NOT above a <Modal> that is
// still open (web's z-999 covers those too).
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useIsMutating } from "@tanstack/react-query";
import { useTheme, withAlpha } from "../lib/theme";

const DOT_COUNT = 8;

// Web: opacity 0.15 -> 1 -> 0.15 over 1s, dot i offset by -i*0.125s. One
// shared 0..1 loop drives every dot; each dot reads it through a
// phase-shifted lookup (9 samples of a smooth ease, exact because the
// offsets are whole eighths of the cycle).
function phaseOpacity(phase: number) {
  return 0.15 + 0.85 * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase));
}
const SAMPLE_INPUT = Array.from({ length: DOT_COUNT + 1 }, (_, k) => k / DOT_COUNT);

function Spinner() {
  const { colors } = useTheme();
  const cycle = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const cycleLoop = Animated.loop(
      Animated.timing(cycle, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    // @keyframes ako-loader-breathe: scale .94 <-> 1, 1.8s ease-in-out
    const ease = Easing.bezier(0.45, 0, 0.55, 1);
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 900, easing: ease, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 900, easing: ease, useNativeDriver: true }),
      ])
    );
    cycleLoop.start();
    breatheLoop.start();
    return () => {
      cycleLoop.stop();
      breatheLoop.stop();
    };
  }, [cycle, breathe]);

  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return (
    <Animated.View style={[styles.loader, { transform: [{ scale }] }]}>
      {Array.from({ length: DOT_COUNT }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: colors.accent,
              opacity: cycle.interpolate({
                inputRange: SAMPLE_INPUT,
                outputRange: SAMPLE_INPUT.map((_, k) => phaseOpacity(((k + i) % DOT_COUNT) / DOT_COUNT)),
              }),
              transform: [{ rotate: `${i * 45}deg` }, { translateY: -15 }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

function Overlay() {
  const { colors, isDark } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;

  // animate-ako-overlay-in: opacity 0 -> 1, 180ms ease-out
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 180,
      easing: Easing.bezier(0, 0, 0.58, 1),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    // Swallows every touch so nothing behind can be tapped mid-save.
    <View
      style={styles.root}
      onStartShouldSetResponder={() => true}
      accessibilityViewIsModal
      accessibilityLabel="Saving"
      accessibilityLiveRegion="polite"
    >
      {/* bg-canvas/35 + backdrop-blur-sm */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <BlurView
          intensity={20}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(colors.canvas, 0.35) }]} />
      </Animated.View>
      <Spinner />
    </View>
  );
}

export function LoadingOverlay() {
  const blockingCount = useIsMutating({
    predicate: (mutation) => mutation.options.meta?.blocking === true,
  });

  if (blockingCount === 0) return null;
  return <Overlay />;
}

const styles = StyleSheet.create({
  // fixed inset-0 z-[999] flex items-center justify-center — elevation
  // matters on Android, where it outranks zIndex (BottomNav is 40).
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
    elevation: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  loader: { width: 34, height: 34 },
  // 4px dot centered in the 34px box, then rotated out to radius 15
  dot: { position: "absolute", top: 15, left: 15, width: 4, height: 4, borderRadius: 2 },
});

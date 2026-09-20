// File: components/LikeHeart.tsx
// Port of web's src/components/LikeHeart.tsx — drop-in replacement for
// a plain <Heart fill={...}/> that animates only on the false→true
// transition (liking, not un-liking, never on initial mount): a quick
// overshoot pop plus a small burst of sparks, so liking something reads
// as a tiny rewarded moment instead of a color swap. Used by PostCard,
// ProjectCard, and CommentSheet.
//
// Web drives the pop/spark keyframes with a CSS animation class
// (ako-like-pop / ako-like-spark) plus CSS custom properties for each
// spark's (x, y) offset, and gets its color for free from `currentColor`
// (the icon inherits whatever text color className sets). RN has
// neither CSS keyframes nor a color cascade, so:
//   - the pop is an Animated.Value driving `scale` via a two-step
//     sequence (overshoot then settle back to 1)
//   - each spark is a small Animated.View whose translateX/Y is
//     interpolated from a single shared progress value out to its own
//     precomputed (x, y), fading out over the same run
//   - color is an explicit prop instead of inherited `currentColor`
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Heart } from "lucide-react-native";

interface LikeHeartProps {
  active: boolean;
  size?: number;
  // Explicit stand-in for web's `currentColor` — pass the same color
  // the surrounding action row's icon/label uses.
  color: string;
}

const SPARK_COUNT = 6;
const SPARK_RADIUS = 15;
const POP_UP_MS = 150;
const POP_DOWN_MS = 250;
const SPARK_MS = 500;

export function LikeHeart({ active, size = 24, color }: LikeHeartProps) {
  const wasActive = useRef(active);
  const [animating, setAnimating] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active && !wasActive.current) {
      setAnimating(true);
      scale.setValue(1);
      progress.setValue(0);

      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.3,
          duration: POP_UP_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: POP_DOWN_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();

      Animated.timing(progress, {
        toValue: 1,
        duration: SPARK_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => setAnimating(false));
    }
    wasActive.current = active;
  }, [active, scale, progress]);

  // Sparks fade in fast then out — web's ako-like-spark keyframes.
  const sparkOpacity = progress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 1, 0],
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Heart size={size} color={color} fill={active ? color : "none"} />
      </Animated.View>

      {animating &&
        Array.from({ length: SPARK_COUNT }).map((_, i) => {
          const angle = (360 / SPARK_COUNT) * i;
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * SPARK_RADIUS;
          const y = Math.sin(rad) * SPARK_RADIUS;
          const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, x] });
          const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, y] });

          return (
            <Animated.View
              key={i}
              style={[
                styles.spark,
                {
                  backgroundColor: color,
                  opacity: sparkOpacity,
                  transform: [{ translateX }, { translateY }],
                },
              ]}
            />
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  spark: { position: "absolute", width: 4, height: 4, borderRadius: 2 },
});

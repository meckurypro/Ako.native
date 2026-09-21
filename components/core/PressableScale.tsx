import type { PropsWithChildren } from "react";
import { Pressable, type PressableProps } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({ children, onPressIn, onPressOut, disabled, ...props }: PropsWithChildren<PressableProps>) {
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => { scale.set(withTiming(reducedMotion ? 1 : 0.97, { duration: 100 })); onPressIn?.(event); }}
      onPressOut={(event) => { scale.set(withTiming(1, { duration: 140 })); onPressOut?.(event); }}
      style={[animatedStyle, typeof props.style === "function" ? props.style({ pressed: false, hovered: false }) : props.style, disabled && { opacity: 0.5 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

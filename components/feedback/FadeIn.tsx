import type { PropsWithChildren } from "react";
import Animated, { FadeIn as ReanimatedFadeIn, useReducedMotion } from "react-native-reanimated";
export function FadeIn({ children, delay = 0 }: PropsWithChildren<{ delay?: number }>) { const reduced = useReducedMotion(); return <Animated.View entering={reduced ? undefined : ReanimatedFadeIn.duration(240).delay(delay)}>{children}</Animated.View>; }

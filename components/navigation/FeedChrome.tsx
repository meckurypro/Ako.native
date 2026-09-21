import { createContext, type PropsWithChildren, useContext } from "react";
import { Easing, type SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

type Chrome = { progress: SharedValue<number>; scrollHandler: ReturnType<typeof useAnimatedScrollHandler> };
const FeedChromeContext = createContext<Chrome | null>(null);

export function FeedChromeProvider({ children }: PropsWithChildren) {
  const progress = useSharedValue(0); const previousY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      const y = Math.max(0, event.contentOffset.y); const delta = y - previousY.value; previousY.value = y;
      if (y <= 8) { if (progress.value) progress.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) }); return; }
      if (delta > 6 && progress.value === 0) progress.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
      if (delta < -6 && progress.value === 1) progress.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
    },
  });
  return <FeedChromeContext.Provider value={{ progress, scrollHandler }}>{children}</FeedChromeContext.Provider>;
}

export function useFeedChrome() { const chrome = useContext(FeedChromeContext); if (!chrome) throw new Error("useFeedChrome must be used within FeedChromeProvider"); return chrome; }
export function useFeedChromeStyle(distance: number) { const { progress } = useFeedChrome(); return useAnimatedStyle(() => ({ opacity: 1 - progress.value, transform: [{ translateY: progress.value * distance }] })); }

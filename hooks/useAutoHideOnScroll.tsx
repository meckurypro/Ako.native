// File: hooks/useAutoHideOnScroll.tsx
//
// Web: each component attached its own window "scroll" listener. Native
// has no window scroll — scrolling happens inside a specific ScrollView /
// FlatList — so the top bar (in a screen) and the bottom nav (at the root)
// can't each listen independently. Instead this is one shared context:
// a screen's main scroller calls the handler from useAutoHideScrollHandler(),
// and AutoHideTopBar / BottomNav read the resulting `visible` flag from
// useAutoHideOnScroll(). Same thresholds as web:
//   - always shown within 8px of the top
//   - hides after >6px of downward scroll delta, shows after >6px upward
//
// Usage on any screen's main vertical scroller:
//   const onScroll = useAutoHideScrollHandler();
//   <ScrollView onScroll={onScroll} scrollEventThrottle={16} ... />
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { usePathname } from "expo-router";

const SHOW_NEAR_TOP_PX = 8;
const THRESHOLD_PX = 6;

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;

interface AutoHideContextValue {
  visible: boolean;
  onScroll: ScrollHandler;
}

const AutoHideContext = createContext<AutoHideContextValue | null>(null);

export function AutoHideProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const pathname = usePathname();

  // Web pages each start at scrollY 0 with chrome visible; a screen change
  // on native should do the same.
  useEffect(() => {
    lastY.current = 0;
    setVisible(true);
  }, [pathname]);

  const onScroll = useCallback<ScrollHandler>((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    // Clamp both ends so iOS rubber-banding (past the top OR the bottom)
    // can't register as a direction change and flicker the bars.
    const maxY = Math.max(contentSize.height - layoutMeasurement.height, 0);
    const y = Math.min(Math.max(contentOffset.y, 0), maxY);
    const delta = y - lastY.current;

    if (y <= SHOW_NEAR_TOP_PX) {
      setVisible(true);
    } else if (delta > THRESHOLD_PX) {
      setVisible(false);
    } else if (delta < -THRESHOLD_PX) {
      setVisible(true);
    }

    lastY.current = y;
  }, []);

  const value = useMemo(() => ({ visible, onScroll }), [visible, onScroll]);

  return <AutoHideContext.Provider value={value}>{children}</AutoHideContext.Provider>;
}

function useAutoHideContext(): AutoHideContextValue {
  const ctx = useContext(AutoHideContext);
  if (!ctx) throw new Error("useAutoHideOnScroll must be used within <AutoHideProvider>");
  return ctx;
}

/** Whether the top/bottom chrome should currently be showing. */
export function useAutoHideOnScroll(): boolean {
  return useAutoHideContext().visible;
}

/** Attach to a screen's main vertical scroller's onScroll. */
export function useAutoHideScrollHandler(): ScrollHandler {
  return useAutoHideContext().onScroll;
}

// File: components/SwipeableTabs.tsx
//
// Native counterpart to web's SwipeableTabs. Same contract — the parent owns
// `index`, gets `onIndexChange` once a swipe settles (or a tab button jumps),
// and passes one pane per tab — but the mechanics are native instead of a
// hand-rolled touch tracker:
//
//   web:    all panes in one flex row, translated by JS from raw touch
//           events (axis lock, 1/3-width + velocity commit, 2.5x edge
//           resistance, ResizeObserver height tracking, window scroll
//           position bookkeeping per tab)
//   native: a horizontal paging ScrollView. The OS does the finger tracking,
//           axis lock, flick/commit decision and edge bounce; each pane
//           owns its own vertical ScrollView, so per-tab scroll position and
//           per-pane height come for free (no height animation needed).
//
// Kept from web: panes mount lazily — the active one plus its immediate
// neighbors (see the long note on web about why every pane of a busy feed
// mounting at once fights the swipe gesture), and only ever grow.
//
// The live tab position (for a sliding indicator) is exposed as a
// parent-owned `scrollX` Animated.Value in px, driven natively (no JS
// re-render per frame): with pane width = screen width, tab position is
// scrollX / width. Web's onProgress(progress, dragging) callback isn't
// needed — `dragging` only existed to switch off the indicator's CSS
// transition mid-drag, and here the indicator is bound to scrollX directly.
//
// Pane width is the window width, so mount this full-bleed (no horizontal
// padding around it) and let each pane pad its own content.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

interface SwipeableTabsProps {
  /** Index of the currently active tab (owned by the parent, e.g. via useTabState). */
  index: number;
  /** Called once a swipe settles on a new tab. Not called for changes the parent made itself. */
  onIndexChange: (index: number) => void;
  /** Optional: receives the horizontal scroll offset in px, natively driven. */
  scrollX?: Animated.Value;
  /** One pane per tab, in tab order. */
  children: ReactNode[];
}

export function SwipeableTabs({ index, onIndexChange, scrollX, children }: SwipeableTabsProps) {
  const count = children.length;
  const { width } = useWindowDimensions();
  const scrollRef = useRef<any>(null);
  const indexRef = useRef(index);
  const isFirstRender = useRef(true);

  // Lazily mounted panes — active + immediate neighbors, only ever grows.
  const [visited, setVisited] = useState<Set<number>>(() => {
    const initial = new Set<number>([index]);
    if (index > 0) initial.add(index - 1);
    if (index < count - 1) initial.add(index + 1);
    return initial;
  });

  useEffect(() => {
    setVisited((prev) => {
      const alreadyHasNeighbors =
        prev.has(index) && (index === 0 || prev.has(index - 1)) && (index === count - 1 || prev.has(index + 1));
      if (alreadyHasNeighbors) return prev;

      const next = new Set(prev);
      next.add(index);
      if (index > 0) next.add(index - 1);
      if (index < count - 1) next.add(index + 1);
      return next;
    });
  }, [index, count]);

  // Parent changed the tab (a tab-button tap, a ?tab= link) → slide there.
  // Also fires after a swipe settles, when the parent echoes the new index
  // back; the scroll is already at that position so it's a no-op.
  useEffect(() => {
    indexRef.current = index;
    scrollRef.current?.scrollTo({ x: index * width, y: 0, animated: !isFirstRender.current });
    isFirstRender.current = false;
  }, [index, width]);

  const onScroll = useMemo(
    () =>
      scrollX
        ? Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })
        : undefined,
    [scrollX]
  );

  function handleSettle(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.max(0, Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.x / width)));
    if (next !== indexRef.current) onIndexChange(next);
  }

  return (
    <Animated.ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      decelerationRate="fast"
      directionalLockEnabled
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onScroll}
      onMomentumScrollEnd={handleSettle}
      // iOS honors this for the first frame; the effect above covers Android.
      contentOffset={{ x: index * width, y: 0 }}
      style={{ flex: 1 }}
    >
      {children.map((child, i) => (
        <View key={i} style={{ width }}>
          {visited.has(i) ? child : null}
        </View>
      ))}
    </Animated.ScrollView>
  );
}

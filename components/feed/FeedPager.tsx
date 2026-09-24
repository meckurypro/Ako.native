import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, View, useWindowDimensions } from "react-native";
import { Icon } from "@/components/core/Icon";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, withTiming, type SharedValue } from "react-native-reanimated";
import { Text } from "@/components/core";
import { EmptyState, ErrorState, OfflineState } from "@/components/feedback";
import { getScreenState } from "@/lib/screenState";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";
import { PostCard } from "@/components/feed/PostCard";
import { FeedSwipeGestureContext } from "@/components/feed/FeedSwipeGesture";
import { useFeedChrome } from "@/components/navigation/FeedChrome";
import { useFeed, useTopicFeed } from "@/features/feed/api";
import type { FeedMode, Post } from "@/features/feed/types";
import { prefetchImages } from "@/lib/media-cache";
import { useTheme } from "@/providers/ThemeProvider";

const MODES: FeedMode[] = ["ranked", "top", "following"];
// Matches web's SwipeableTabs (src/components/SwipeableTabs.tsx). COMMIT_VELOCITY is web's
// 0.5 px/ms converted to this gesture handler's px/s units (0.5 px/ms == 500 px/s) — this used
// to be 800, a noticeably stiffer flick threshold than web's, which read as heavier/less
// responsive next to it.
const COMMIT_RATIO = .33; const COMMIT_VELOCITY = 500; const EDGE_RESISTANCE = 2.5;
// Same 300ms cubic-bezier web uses for both the drag-settle and a tab-button jump, instead of a
// spring: a spring (withSpring) can overshoot/oscillate past the target, which is what read as
// "too much" next to web's single deterministic curve.
const SETTLE_DURATION = 300; const SETTLE_EASING = Easing.bezier(0.16, 1, 0.3, 1);

type Props = { index: number; onIndexChange: (index: number) => void; interestId?: string; progress: SharedValue<number> };

const FeedPane = memo(function FeedPane({ mode, interestId, nativeGesture }: { mode: FeedMode; interestId?: string; nativeGesture: ReturnType<typeof Gesture.Native> }) {
  const rankedFeed = useFeed(mode, !(mode === "ranked" && !!interestId)); const topicFeed = useTopicFeed(mode === "ranked" ? interestId : undefined); const feed = mode === "ranked" && interestId ? topicFeed : rankedFeed; const { colors } = useTheme(); const { scrollHandler } = useFeedChrome(); const insets = useSafeAreaInsets(); const router = useRouter();
  const posts = feed.data?.pages.flat() ?? []; const render = useCallback(({ item }: { item: Post }) => <PostCard post={item} />, []);
  // Every time a new page lands (initial load, or another page from
  // onEndReached), warm expo-image's disk cache for the avatars and lead
  // image of the posts in it, so they've usually already finished
  // downloading by the time the FlatList actually scrolls them into view.
  const pageCount = feed.data?.pages.length ?? 0;
  useEffect(() => {
    const lastPage = feed.data?.pages.at(-1);
    if (!lastPage?.length) return;
    prefetchImages(lastPage.flatMap(post => [post.author.avatar_url, post.posted_as_page?.avatar_url ?? null, post.media_urls[0] ?? null]));
  }, [feed.data, pageCount]);
  const empty = mode === "following" ? "No posts from people you follow yet. Follow a few people to see their posts here." : mode === "top" ? "Nothing's picked up much discussion in the last week yet." : "No posts yet. Be the first to share a thought.";
  if (getScreenState(feed) === "offline" && !posts.length) return <OfflineState onRetry={() => void feed.refetch()} />;
  if (feed.isLoading && !posts.length) return <FeedSkeleton />;
  if (feed.isError && !posts.length) return <ErrorState message="Couldn't load your feed." onRetry={() => void feed.refetch()} />;
  // Wrapping the list's own native scroll/RefreshControl gesture and declaring
  // it simultaneous with the pager's outer Pan (below) means the two no longer
  // race for the first touch — the pull-to-refresh gesture used to lose that
  // race intermittently because the outer Pan's GestureDetector could claim the
  // touch before RefreshControl got a chance to recognize a downward drag.
  return <GestureDetector gesture={nativeGesture}><Animated.FlatList data={posts} renderItem={render} keyExtractor={item => item.id} contentContainerStyle={[s.list, { paddingTop: insets.top + 129, paddingBottom: insets.bottom + 100 }]} ListHeaderComponent={mode === "ranked" && interestId ? <Text color="accent" onPress={() => router.replace("/(tabs)/home")} style={[s.topicChip, { backgroundColor: colors.accentSoft }]}>Filtered by topic  <Icon name="x" size={14} color={colors.accent} /></Text> : null} ItemSeparatorComponent={Separator} onScroll={scrollHandler} scrollEventThrottle={16} refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => void feed.refetch()} tintColor={colors.accent} />} onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage(); }} onEndReachedThreshold={.5} ListEmptyComponent={<EmptyState icon="file-text" title="Nothing here yet" message={empty} />} ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={s.loading} /> : <View style={s.footer} />} initialNumToRender={5} maxToRenderPerBatch={6} windowSize={7} /></GestureDetector>;
});
const Separator = () => <View style={s.separator} />;

export function FeedPager({ index, onIndexChange, interestId, progress }: Props) {
  const { width } = useWindowDimensions(); const [visited, setVisited] = useState<Set<number>>(() => new Set([0, 1]));
  const nativeGestures = useMemo(() => Object.fromEntries(MODES.map(mode => [mode, Gesture.Native()])) as Record<FeedMode, ReturnType<typeof Gesture.Native>>, []);
  const ensureVisited = useCallback((next: number) => setVisited(current => current.has(next) ? current : new Set([...current, next])), []);
  useEffect(() => { progress.set(withTiming(index, { duration: SETTLE_DURATION, easing: SETTLE_EASING })); }, [index, progress]);
  const settle = useCallback((next: number) => { ensureVisited(next); onIndexChange(next); }, [ensureVisited, onIndexChange]);
  const pan = useMemo(() => Gesture.Pan().activeOffsetX([-6, 6]).failOffsetY([-6, 6])
    .onUpdate(event => {
      "worklet";
      const current = index;
      let drag = event.translationX;
      if ((current === 0 && drag > 0) || (current === 2 && drag < 0)) drag /= EDGE_RESISTANCE;
      const position = current - drag / width;
      const nextProgress = Math.max(0, Math.min(2, position));
      progress.set(nextProgress);
      const neighbor = drag < -6 ? Math.min(2, current + 1) : drag > 6 ? Math.max(0, current - 1) : current;
      if (neighbor !== current) runOnJS(ensureVisited)(neighbor);
    })
    .onEnd(event => {
      "worklet";
      const current = index;
      const ratio = event.translationX / width;
      let next = current;
      if (ratio <= -COMMIT_RATIO || event.velocityX <= -COMMIT_VELOCITY) next = Math.min(2, current + 1);
      else if (ratio >= COMMIT_RATIO || event.velocityX >= COMMIT_VELOCITY) next = Math.max(0, current - 1);
      progress.set(withTiming(next, { duration: SETTLE_DURATION, easing: SETTLE_EASING }));
      if (next !== current) runOnJS(settle)(next);
    }), [ensureVisited, index, progress, settle, width]);
  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -progress.value * width }] }));
  const composed = useMemo(() => Gesture.Simultaneous(pan, ...Object.values(nativeGestures)), [pan, nativeGestures]);
  return <FeedSwipeGestureContext.Provider value={pan}><GestureDetector gesture={composed}><Animated.View style={[s.track, { width: width * 3 }, trackStyle]}>{MODES.map((mode, pane) => <View key={mode} style={{ width }}>{visited.has(pane) || pane === index ? <FeedPane mode={mode} interestId={mode === "ranked" ? interestId : undefined} nativeGesture={nativeGestures[mode]} /> : <View style={{ flex: 1 }} />}</View>)}</Animated.View></GestureDetector></FeedSwipeGestureContext.Provider>;
}

const s = StyleSheet.create({ track: { flex: 1, flexDirection: "row" }, list: { paddingHorizontal: 20, flexGrow: 1 }, topicChip: { alignSelf: "flex-start", overflow: "hidden", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 16, fontSize: 14 }, separator: { height: 16 }, loading: { margin: 20 }, footer: { height: 12 } });

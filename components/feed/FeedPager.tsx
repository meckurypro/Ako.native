import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, View, useWindowDimensions } from "react-native";
import { Icon } from "@/components/core/Icon";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Text } from "@/components/core";
import { EmptyState, ErrorState } from "@/components/feedback";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";
import { PostCard } from "@/components/feed/PostCard";
import { FeedSwipeGestureContext } from "@/components/feed/FeedSwipeGesture";
import { useFeedChrome } from "@/components/navigation/FeedChrome";
import { useFeed, useTopicFeed } from "@/features/feed/api";
import type { FeedMode, Post } from "@/features/feed/types";
import { useTheme } from "@/providers/ThemeProvider";

const MODES: FeedMode[] = ["ranked", "top", "following"];
const COMMIT_RATIO = .33; const COMMIT_VELOCITY = 800; const EDGE_RESISTANCE = 2.5;

type Props = { index: number; onIndexChange: (index: number) => void; interestId?: string };

const FeedPane = memo(function FeedPane({ mode, interestId, nativeGesture }: { mode: FeedMode; interestId?: string; nativeGesture: ReturnType<typeof Gesture.Native> }) {
  const rankedFeed = useFeed(mode, !(mode === "ranked" && !!interestId)); const topicFeed = useTopicFeed(mode === "ranked" ? interestId : undefined); const feed = mode === "ranked" && interestId ? topicFeed : rankedFeed; const { colors } = useTheme(); const { scrollHandler } = useFeedChrome(); const insets = useSafeAreaInsets(); const router = useRouter();
  const posts = feed.data?.pages.flat() ?? []; const render = useCallback(({ item }: { item: Post }) => <PostCard post={item} />, []);
  const empty = mode === "following" ? "No posts from people you follow yet. Follow a few people to see their posts here." : mode === "top" ? "Nothing's picked up much discussion in the last week yet." : "No posts yet. Be the first to share a thought.";
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

export function FeedPager({ index, onIndexChange, interestId }: Props) {
  const { width } = useWindowDimensions(); const translateX = useSharedValue(-index * width); const [visited, setVisited] = useState<Set<number>>(() => new Set([0, 1]));
  const nativeGestures = useMemo(() => Object.fromEntries(MODES.map(mode => [mode, Gesture.Native()])) as Record<FeedMode, ReturnType<typeof Gesture.Native>>, []);
  const ensureVisited = useCallback((next: number) => setVisited(current => current.has(next) ? current : new Set([...current, next])), []);
  useEffect(() => { translateX.set(withSpring(-index * width, { damping: 20, stiffness: 220 })); }, [index, translateX, width]);
  const settle = useCallback((next: number) => { ensureVisited(next); onIndexChange(next); }, [ensureVisited, onIndexChange]);
  const pan = useMemo(() => Gesture.Pan().activeOffsetX([-6, 6]).failOffsetY([-6, 6])
    .onUpdate(event => {
      "worklet";
      const current = index;
      let drag = event.translationX;
      if ((current === 0 && drag > 0) || (current === 2 && drag < 0)) drag /= EDGE_RESISTANCE;
      const position = current - drag / width;
      const nextProgress = Math.max(0, Math.min(2, position));
      translateX.set(-nextProgress * width);
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
      translateX.set(withSpring(-next * width, { damping: 20, stiffness: 220 }));
      if (next !== current) runOnJS(settle)(next);
    }), [ensureVisited, index, settle, translateX, width]);
  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const composed = useMemo(() => Gesture.Simultaneous(pan, ...Object.values(nativeGestures)), [pan, nativeGestures]);
  return <FeedSwipeGestureContext.Provider value={pan}><GestureDetector gesture={composed}><Animated.View style={[s.track, { width: width * 3 }, trackStyle]}>{MODES.map((mode, pane) => <View key={mode} style={{ width }}>{visited.has(pane) || pane === index ? <FeedPane mode={mode} interestId={mode === "ranked" ? interestId : undefined} nativeGesture={nativeGestures[mode]} /> : <View style={{ flex: 1 }} />}</View>)}</Animated.View></GestureDetector></FeedSwipeGestureContext.Provider>;
}

const s = StyleSheet.create({ track: { flex: 1, flexDirection: "row" }, list: { paddingHorizontal: 20, flexGrow: 1 }, topicChip: { alignSelf: "flex-start", overflow: "hidden", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 16, fontSize: 14 }, separator: { height: 16 }, loading: { margin: 20 }, footer: { height: 12 } });

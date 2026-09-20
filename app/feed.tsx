// File: app/feed.tsx
//
// Port of web's src/pages/Feed.tsx: For You / Top Discussions / Following,
// swipeable, with the same data logic (page-mode feeds, topic filter,
// just-posted pinning, "back to post" fetch + scroll + flash, accumulated
// "Load more" pages, per-tab `active` deferral for PostCard's queries).
//
// Native differences worth knowing:
//   - Each tab is its own vertical ScrollView inside a horizontal paging
//     SwipeableTabs (web scrolls the whole page). The tab row lives in the
//     AutoHideTopBar overlay, so every pane pads its content by the bar's
//     height, and only the *current* pane feeds the shared auto-hide handler.
//   - The sliding indicator is bound to the pager's scrollX (native-driven),
//     so it tracks the finger 1:1 always; web's springy overshoot after a
//     release isn't reproduced.
//   - Web's router `location.state` (justPostedId / scrollToPostId) becomes
//     route params (`/feed?justPostedId=…`); they're captured once on mount
//     and then blanked so a later remount doesn't replay them.
//   - Web's `?interest=` / `?tab=` are seeded from route params, then kept in
//     state (see hooks/useTabState).
//   - PostCardPlaceholder stands in for PostCard until that's ported.
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useFeedPosts, useFollowingFeed, useTopDiscussionsFeed, usePostById } from "../hooks/usePosts";
import { usePageRankedFeed, usePageFollowingFeed } from "../hooks/usePageFeed";
import { useActiveIdentity } from "../hooks/usePages";
import { useTabState } from "../hooks/useTabState";
import { useAutoHideScrollHandler } from "../hooks/useAutoHideOnScroll";
import { PostCardPlaceholder as PostCard } from "../components/PostCardPlaceholder";
import { AutoHideTopBar } from "../components/AutoHideTopBar";
import { TopHeader } from "../components/TopHeader";
import { SwipeableTabs } from "../components/SwipeableTabs";
import { Button } from "../components/Button";
import { useTheme, withAlpha } from "../lib/theme";

// "Saved" moved into the Activity hub (see SavedHub.tsx, reachable
// from the Activity icon in BottomNav) — it now covers saved posts
// AND saved projects in one place, rather than living here as a
// posts-only feed tab.
const TABS = [
  { key: "for-you", label: "For You" },
  { key: "top", label: "Top Discussions" },
  { key: "following", label: "Following" },
] as const;

type TabKey = (typeof TABS)[number]["key"];
const TAB_KEYS = TABS.map((t) => t.key);

const firstParam = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) || undefined;

function useAccumulatedPages<T>(pageData: T[] | undefined, page: number, resetKey: unknown) {
  const [all, setAll] = useState<T[]>([]);

  useEffect(() => {
    setAll([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (!pageData) return;
    setAll((prev) => (page === 0 ? pageData : [...prev, ...pageData]));
  }, [pageData, page]);

  return all;
}

// One tab's vertical scroller. Pads for the top bar overlay (web: pt-5
// under the sticky bar) and the bottom nav, and reports scroll to the
// shared auto-hide handler only while it's the pane on screen — otherwise
// three panes' offsets would fight over the one lastY the handler keeps.
function TabScroll({
  current,
  topInset,
  scrollRef,
  children,
}: {
  current: boolean;
  topInset: number;
  scrollRef?: React.RefObject<ScrollView | null>;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const onScroll = useAutoHideScrollHandler();

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      onScroll={current ? onScroll : undefined}
      scrollEventThrottle={16}
      scrollIndicatorInsets={{ top: topInset }}
      contentContainerStyle={{
        paddingTop: topInset,
        paddingBottom: 96 + insets.bottom,
        paddingHorizontal: 20,
      }}
    >
      {children}
    </ScrollView>
  );
}

function EmptyState({ message }: { message: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.emptyState, { color: colors.inkMuted }]}>{message}</Text>;
}

function StatusText({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "danger" }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.statusText, { color: tone === "danger" ? colors.danger : colors.inkMuted }]}>
      {children}
    </Text>
  );
}

function LoadMoreButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.loadMore}>
      <Text style={[styles.loadMoreText, { color: colors.accent }]}>Load more</Text>
    </Pressable>
  );
}

// Briefly flashes the post that sent a visitor off to a profile they've now
// tapped "Back to post" to return from (see ProfilePage's fromFeedPost /
// "Back to post" FAB, which navigates here with scrollToPostId). Same idea as
// web: highlighted on arrival, then fades out after 2.5s (700ms fade).
//
// Only wired into "For You" below — the tab a fresh /feed load always
// lands on — not Following/Top Discussions, since there's no reliable
// way to know which of the three tabs the originating post actually
// came from.
function FeedPostRow({
  post,
  isTarget,
  active,
  onLayout,
}: {
  post: any;
  isTarget: boolean;
  active: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const { colors } = useTheme();
  const flash = useRef(new Animated.Value(isTarget ? 1 : 0)).current;

  useEffect(() => {
    if (!isTarget) return;
    flash.setValue(1);
    const timeout = setTimeout(() => {
      Animated.timing(flash, { toValue: 0, duration: 700, useNativeDriver: false }).start();
    }, 2500);
    return () => {
      clearTimeout(timeout);
      flash.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTarget]);

  const backgroundColor = flash.interpolate({
    inputRange: [0, 1],
    outputRange: [withAlpha(colors.highlight, 0), colors.highlight],
  });

  // web: rounded-lg, and -mx-2 px-2 while flashing so the highlight bleeds
  // a little past the card. Applied always here (invisible when not
  // flashing) to avoid a layout jump.
  return (
    <Animated.View
      onLayout={onLayout}
      style={{ backgroundColor, borderRadius: 8, marginHorizontal: -8, paddingHorizontal: 8 }}
    >
      <PostCard post={post} active={active} />
    </Animated.View>
  );
}

function ForYouTab({
  interestId,
  justPostedId,
  scrollToPostId,
  active,
  current,
  topInset,
  onClearInterest,
}: {
  interestId?: string;
  justPostedId?: string | null;
  scrollToPostId?: string | null;
  active: boolean;
  current: boolean;
  topInset: number;
  onClearInterest: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const didScrollToTarget = useRef(false);

  const [page, setPage] = useState(0);
  const { data: identity } = useActiveIdentity();
  const activePageId = identity?.mode === "page" ? identity.page.id : undefined;
  const isPageMode = !!activePageId && !interestId;

  // Topic-filtered browsing ("everything tagged X") stays identity-
  // agnostic — only the personalized ranking swaps to the page's own
  // when acting as a page. See usePageFeed.ts for why.
  const personal = useFeedPosts(interestId, page);
  const pageFeed = usePageRankedFeed(isPageMode ? activePageId : undefined, page);
  const { data: pagePosts, isLoading, isFetching, error } = isPageMode ? pageFeed : personal;
  const posts = useAccumulatedPages(pagePosts, page, interestId ?? (isPageMode ? activePageId : "personal"));

  useEffect(() => setPage(0), [interestId, isPageMode]);

  // Right after publishing, wait for BOTH the ranked feed's fresh
  // refetch (triggered by useCreatePost's invalidate) and this one
  // post's own fetch before showing anything — a single loading state
  // that resolves once, into the final result, rather than flashing
  // the pre-post feed and then reordering when the refetch lands.
  // Only applies to page 0 of the plain, no-topic-filter "For You"
  // list — the one Compose actually redirects to.
  const pinning = !!justPostedId && page === 0 && !interestId && !isPageMode;
  const { data: justPostedPost, isLoading: isLoadingJustPosted, isError: justPostedFailed } = usePostById(
    pinning ? justPostedId : null
  );
  const waitingForFreshFeed = pinning && (isLoading || isFetching || (isLoadingJustPosted && !justPostedFailed));

  // "Back to post" fallback — if the target post isn't anywhere in
  // what's currently loaded (it's further down in pagination than
  // we've fetched, or it was originally seen in Following/Top
  // Discussions/a topic filter rather than this plain ranked list),
  // fetch it directly by id instead of silently having nothing to
  // scroll to. Checked against the raw `posts` page — close enough,
  // since justPostedPost and this are never the same post.
  const scrollTargetInList = !!scrollToPostId && posts.some((p) => p.id === scrollToPostId);
  const { data: fetchedScrollToPost } = usePostById(
    scrollToPostId && !scrollTargetInList ? scrollToPostId : null
  );

  // web: scrollIntoView({ block: "center" }). `layout.y` is measured in the
  // scroller's content coordinates (the target, or the wrapper holding it,
  // is a direct child of the content container), so centering is just
  // y minus half the leftover viewport. Once only — layout can fire again
  // as rows above load in.
  function handleTargetLayout(e: LayoutChangeEvent) {
    if (didScrollToTarget.current) return;
    didScrollToTarget.current = true;
    const { y, height } = e.nativeEvent.layout;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - Math.max(0, (windowHeight - height) / 2)), animated: true });
  }

  let body: ReactNode;

  if ((isLoading || waitingForFreshFeed) && page === 0) {
    body = <StatusText>Loading your feed…</StatusText>;
  } else if (error) {
    body = (
      <StatusText tone="danger">
        Couldn't load the feed: {(error as any)?.message ?? String(error)}
        {(error as any)?.hint ? ` — hint: ${(error as any).hint}` : ""}
      </StatusText>
    );
  } else if (posts.length === 0 && page === 0 && !justPostedPost && !fetchedScrollToPost) {
    body = (
      <View style={styles.emptyForYou}>
        <Text style={[styles.emptyForYouText, { color: colors.inkMuted }]}>
          No posts yet. Be the first to share a thought.
        </Text>
        <Button size="sm" onPress={() => router.push("/compose" as any)}>
          Write something
        </Button>
      </View>
    );
  } else {
    // The just-posted post is pinned first — the ranked feed itself has
    // no reason to place a brand-new, zero-engagement post anywhere near
    // the top (see usePostById's comment on get_ranked_feed) — with the
    // rest of the ranked list following, minus that same id in case the
    // algorithm also happened to surface it (avoids a duplicate card).
    const displayedPosts = justPostedPost
      ? [justPostedPost, ...posts.filter((p) => p.id !== justPostedPost.id)]
      : posts;

    // Once fetched, the "back to post" target is pinned above the ranked
    // list (own small label, same idea as "just posted") rather than
    // left wherever the ranking would otherwise put it — filtered out of
    // the ranked list below so it can't ever render twice if a later
    // page happens to also contain it.
    const rankedPosts = fetchedScrollToPost
      ? displayedPosts.filter((p) => p.id !== fetchedScrollToPost.id)
      : displayedPosts;

    body = (
      <>
        {fetchedScrollToPost && (
          <View style={styles.continuing} onLayout={handleTargetLayout}>
            <Text style={[styles.continuingLabel, { color: colors.inkMuted }]}>
              Continuing from where you left off
            </Text>
            <FeedPostRow post={fetchedScrollToPost} isTarget active={active} />
          </View>
        )}
        {rankedPosts.map((post) => {
          const isTarget = !!scrollToPostId && post.id === scrollToPostId;
          return (
            <FeedPostRow
              key={post.id}
              post={post}
              isTarget={isTarget}
              active={active}
              onLayout={isTarget ? handleTargetLayout : undefined}
            />
          );
        })}
        {posts.length > 0 && <LoadMoreButton onPress={() => setPage((p) => p + 1)} />}
      </>
    );
  }

  return (
    <TabScroll current={current} topInset={topInset} scrollRef={scrollRef}>
      {interestId && (
        <Pressable
          onPress={onClearInterest}
          accessibilityRole="button"
          style={[styles.chip, { backgroundColor: colors.accentSoft }]}
        >
          <Text style={[styles.chipText, { color: colors.accent }]}>Filtered by topic</Text>
          <X size={14} color={colors.accent} />
        </Pressable>
      )}
      {body}
    </TabScroll>
  );
}

function FollowingTab({ active, current, topInset }: { active: boolean; current: boolean; topInset: number }) {
  const [page, setPage] = useState(0);
  const { data: identity } = useActiveIdentity();
  const activePageId = identity?.mode === "page" ? identity.page.id : undefined;
  const isPageMode = !!activePageId;

  const personal = useFollowingFeed(page);
  const pageFeed = usePageFollowingFeed(isPageMode ? activePageId : undefined, page);
  const { data: pagePosts, isLoading, error } = isPageMode ? pageFeed : personal;
  const posts = useAccumulatedPages(pagePosts, page, isPageMode ? activePageId : "personal");

  useEffect(() => setPage(0), [isPageMode]);

  let body: ReactNode;
  if (isLoading && page === 0) body = <StatusText>Loading…</StatusText>;
  else if (error) body = <StatusText tone="danger">Couldn't load this feed. Try again.</StatusText>;
  else if (posts.length === 0 && page === 0) {
    body = <EmptyState message="No posts from people you follow yet. Follow a few people to see their posts here." />;
  } else {
    body = (
      <>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} active={active} />
        ))}
        {posts.length > 0 && <LoadMoreButton onPress={() => setPage((p) => p + 1)} />}
      </>
    );
  }

  return (
    <TabScroll current={current} topInset={topInset}>
      {body}
    </TabScroll>
  );
}

function TopDiscussionsTab({ active, current, topInset }: { active: boolean; current: boolean; topInset: number }) {
  const [page, setPage] = useState(0);
  const { data: pagePosts, isLoading, error } = useTopDiscussionsFeed(page);
  const posts = useAccumulatedPages(pagePosts, page, "top");

  let body: ReactNode;
  if (isLoading && page === 0) body = <StatusText>Loading…</StatusText>;
  else if (error) body = <StatusText tone="danger">Couldn't load this feed. Try again.</StatusText>;
  else if (posts.length === 0 && page === 0) {
    body = <EmptyState message="Nothing's picked up much discussion in the last week yet." />;
  } else {
    body = (
      <>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} active={active} />
        ))}
        {posts.length > 0 && <LoadMoreButton onPress={() => setPage((p) => p + 1)} />}
      </>
    );
  }

  return (
    <TabScroll current={current} topInset={topInset}>
      {body}
    </TabScroll>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{
    interest?: string;
    justPostedId?: string;
    scrollToPostId?: string;
  }>();

  const [topBarHeight, setTopBarHeight] = useState(0);

  // Topic filter — seeded from `?interest=` (Discover's topic pills), kept
  // in state so the "Filtered by topic" chip can clear it.
  const paramInterest = firstParam(params.interest);
  const [interestId, setInterestId] = useState<string | undefined>(paramInterest);
  useEffect(() => setInterestId(paramInterest), [paramInterest]);

  // Set by Compose right after publishing — captured once into state,
  // independent of the route param's own lifetime, then the params are
  // blanked (web clears location.state with replaceState) so remounting
  // doesn't re-trigger the pin.
  const [justPostedId] = useState<string | null>(() => firstParam(params.justPostedId) ?? null);
  // Set by ProfilePage's "Back to post" FAB — the post whose byline sent the
  // visitor to that profile in the first place. Captured once the same way.
  const [scrollToPostId] = useState<string | null>(() => firstParam(params.scrollToPostId) ?? null);
  useEffect(() => {
    if (justPostedId || scrollToPostId) router.setParams({ justPostedId: "", scrollToPostId: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeTab, setActiveTab] = useTabState<TabKey>(TAB_KEYS, "for-you");
  const activeIndex = TABS.findIndex((t) => t.key === activeTab);

  // Live pager offset → sliding indicator. Pane width == screen width, so
  // one pane of scroll maps to one tab-column of indicator travel.
  const scrollX = useRef(new Animated.Value(activeIndex * width)).current;
  const tabRowWidth = width - 32; // px-4 on the tab row
  const tabColWidth = tabRowWidth / TABS.length;
  const indicatorX = scrollX.interpolate({
    inputRange: [0, width * (TABS.length - 1)],
    outputRange: [0, tabColWidth * (TABS.length - 1)],
  });

  // Which of the three tabs have ever been the active one this visit —
  // starts with just whichever tab is active on mount (usually For You,
  // but a `?tab=` link can land elsewhere), and only ever grows.
  // Passed down as each tab's `active` prop so PostCard can defer its
  // bookmark/like/dislike/hasReshared queries for tabs still marked
  // false. SwipeableTabs mounts a tab's neighbors up front (see its own
  // comment on why), so without this a fresh Feed load fired those
  // queries for every card across neighboring tabs at once. First
  // swipe/tap into a tab flips it to true for good.
  const [visitedTabs, setVisitedTabs] = useState<boolean[]>(() => TABS.map((_, i) => i === activeIndex));
  useEffect(() => {
    setVisitedTabs((prev) => (prev[activeIndex] ? prev : prev.map((v, i) => v || i === activeIndex)));
  }, [activeIndex]);

  useEffect(() => {
    if (interestId) setActiveTab("for-you");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interestId]);

  function handleTabPress(index: number, key: TabKey) {
    if (index === activeIndex) return;
    setActiveTab(key);
  }

  // web: pt-5 under the sticky bar.
  const topInset = topBarHeight + 20;

  return (
    <View style={[styles.flex, { backgroundColor: colors.canvas }]}>
      <SwipeableTabs
        index={activeIndex}
        onIndexChange={(i) => setActiveTab(TABS[i].key)}
        scrollX={scrollX}
      >
        {[
          <ForYouTab
            key="for-you"
            interestId={interestId}
            justPostedId={justPostedId}
            scrollToPostId={scrollToPostId}
            active={visitedTabs[0]}
            current={activeIndex === 0}
            topInset={topInset}
            onClearInterest={() => setInterestId(undefined)}
          />,
          <TopDiscussionsTab key="top" active={visitedTabs[1]} current={activeIndex === 1} topInset={topInset} />,
          <FollowingTab key="following" active={visitedTabs[2]} current={activeIndex === 2} topInset={topInset} />,
        ]}
      </SwipeableTabs>

      <AutoHideTopBar onHeightChange={setTopBarHeight}>
        <TopHeader leftAction="create" />

        {/* Equal-width columns so the three tabs sit evenly spaced
            regardless of label length — "Top Discussions" no longer crowds
            its neighbors. One sliding bar marks the active tab. */}
        <View style={styles.tabRowWrap}>
          <View style={styles.tabRow}>
            {TABS.map((tab, i) => (
              <Pressable
                key={tab.key}
                onPress={() => handleTabPress(i, tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === tab.key }}
                style={styles.tab}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.tabLabel, { color: activeTab === tab.key ? colors.accent : colors.inkMuted }]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
            <Animated.View
              style={[
                styles.indicator,
                { width: tabColWidth, backgroundColor: colors.accent, transform: [{ translateX: indicatorX }] },
              ]}
            />
          </View>
        </View>
      </AutoHideTopBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Tab row — web: px-4 wrapper, `relative grid grid-cols-3 pb-1`, each tab
  // `text-sm font-semibold pb-2 pt-1 text-center`, indicator h-[4px] w-1/3
  // rounded-full pinned to the bottom.
  tabRowWrap: { paddingHorizontal: 16 },
  tabRow: { flexDirection: "row", paddingBottom: 4 },
  tab: { flex: 1, alignItems: "center", paddingTop: 4, paddingBottom: 8 },
  tabLabel: { fontSize: 14, fontWeight: "600" },
  indicator: { position: "absolute", left: 0, bottom: 0, height: 4, borderRadius: 2 },

  // States — web: `py-10` (40) / `py-16` (64) centered text.
  statusText: { textAlign: "center", paddingVertical: 40, paddingHorizontal: 16, fontSize: 16 },
  emptyState: { textAlign: "center", paddingVertical: 64, fontSize: 14 },
  emptyForYou: { alignItems: "center", paddingVertical: 64 },
  emptyForYouText: { marginBottom: 16, fontSize: 16, textAlign: "center" },

  // Load more — web: `w-full text-sm text-accent font-medium py-3 mb-4`.
  loadMore: { width: "100%", alignItems: "center", paddingVertical: 12, marginBottom: 16 },
  loadMoreText: { fontSize: 14, fontWeight: "500" },

  // Topic filter chip — web: `flex items-center gap-1.5 text-sm text-accent
  // bg-accent-soft rounded-full px-3 py-1.5 mb-4 w-fit`.
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  chipText: { fontSize: 14 },

  continuing: { marginBottom: 16 },
  continuingLabel: { fontSize: 12, fontWeight: "500", marginBottom: 8 },
});

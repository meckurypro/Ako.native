import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Icon } from "@/components/core/Icon";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Text, VerifiedBadge } from "@/components/core";
import { ErrorState } from "@/components/feedback";
import { PostCard } from "@/components/feed/PostCard";
import { ProjectMiniCard } from "@/components/projects/ProjectMiniCard";
import { useActiveIdentity } from "@/features/compose/api";
import { type Page, type Person, usePageSuggestedPeople, useSearchPages, useSearchPeople, useSearchPosts, useSearchProjects, useSuggestedPages, useSuggestedPeople } from "@/features/discovery/api";
import type { Project } from "@/features/projects/api";
import { usePageNotifications, usePersonalNotifications } from "@/features/notifications/api";
import { useCategories } from "@/features/onboarding/api";
import { useAuth } from "@/providers/AuthProvider";
import { useFeedChrome, useFeedChromeStyle } from "@/components/navigation/FeedChrome";
import { useTheme } from "@/providers/ThemeProvider";
import { wordmarks } from "@/theme/wordmarks";
import { ProbationalLock } from "@/components/account/ProbationalLock";

// Unified search — People/Pages/Posts/Projects, with an "All" overview that
// previews each and jumps to the full list (mirrors web's Discover + SearchResults).
type SearchTab = "all" | "people" | "pages" | "posts" | "projects";
const SEARCH_TABS: SearchTab[] = ["all", "people", "pages", "posts", "projects"];
const TAB_LABEL: Record<SearchTab, string> = { all: "All", people: "People", pages: "Pages", posts: "Posts", projects: "Projects" };
const PAGE_TYPE_LABEL: Record<string, string> = { organization: "Organisation", brand: "Brand", product: "Product" };
// Rows shown per section on the "All" overview before "See all".
const PREVIEW_COUNT = 3;

function PersonResult({ person }: { person: Person }) { const router = useRouter(); const { colors } = useTheme(); return <Pressable onPress={() => router.push({ pathname: "/profiles/[username]", params: { username: person.username } })} style={({ pressed }) => [s.row, { borderBottomColor: colors.border, opacity: pressed ? .65 : 1 }]}><Avatar uri={person.avatar_url} name={person.display_name} size={40} /><View style={s.rowCopy}><Text numberOfLines={1} style={s.rowName}>{person.display_name}</Text>{person.bio ? <Text numberOfLines={1} color="secondary" style={s.meta}>{person.bio}</Text> : null}<Text color="muted" style={s.meta}>@{person.username}</Text></View>{person.follower_count > 0 && <Text color="muted" style={s.followers}>{person.follower_count.toLocaleString()} followers</Text>}</Pressable>; }

function PageResult({ page }: { page: Page }) { const router = useRouter(); const { colors } = useTheme(); const typeLine = `${PAGE_TYPE_LABEL[page.page_type] ?? page.page_type} · @${page.username}`; return <Pressable onPress={() => router.push({ pathname: "/pages/[username]", params: { username: page.username } })} style={({ pressed }) => [s.row, { borderBottomColor: colors.border, opacity: pressed ? .65 : 1 }]}><Avatar uri={page.avatar_url} name={page.name} size={40} /><View style={s.rowCopy}><View style={s.pageNameRow}><Text numberOfLines={1} style={s.rowName}>{page.name}</Text>{page.is_verified && <VerifiedBadge />}</View><Text numberOfLines={1} color="secondary" style={s.meta}>{page.tagline || typeLine}</Text>{page.tagline ? <Text numberOfLines={1} color="muted" style={s.meta}>{typeLine}</Text> : null}</View>{page.follower_count > 0 && <Text color="muted" style={s.followers}>{page.follower_count.toLocaleString()} followers</Text>}</Pressable>; }

function ProjectGrid({ projects }: { projects: Project[] }) { if (!projects.length) return null; return <View style={s.projectGrid}>{projects.map((project) => <ProjectMiniCard key={project.id} project={project} />)}</View>; }

export default function DiscoverScreen() {
  const { colors, isDark } = useTheme(); const router = useRouter(); const { profile } = useAuth(); const identity = useActiveIdentity();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(""); const [tab, setTab] = useState<SearchTab>("all"); const [openCategory, setOpenCategory] = useState<string | null>(null);
  // Arriving from a #hashtag tap (FormattedText): land straight in Posts for that tag.
  // Re-runs on every `q` change so tapping another hashtag while already here still jumps.
  useEffect(() => { if (typeof q === "string" && q.length > 0) { setQuery(q); setTab("posts"); } }, [q]);
  const pageId = identity.data?.mode === "page" ? identity.data.page.id : undefined; const personalSuggestions = useSuggestedPeople(); const pageSuggestions = usePageSuggestedPeople(pageId); const suggestions = pageId ? pageSuggestions : personalSuggestions;
  const suggestedPages = useSuggestedPages();
  const people = useSearchPeople(query); const pages = useSearchPages(query); const posts = useSearchPosts(query); const projects = useSearchProjects(query); const categories = useCategories(); const personalNotifications = usePersonalNotifications(!pageId); const pageNotifications = usePageNotifications(pageId, !!pageId);
  const notificationRows = pageId ? pageNotifications.data : personalNotifications.data; const unread = notificationRows?.filter((item) => !item.read_at).length ?? 0; const isSearching = query.trim().length > 1;
  const peopleResults = useMemo(() => people.data?.pages.flat() ?? [], [people.data]); const pagesResults = useMemo(() => pages.data?.pages.flat() ?? [], [pages.data]); const projectsResults = useMemo(() => projects.data?.pages.flat() ?? [], [projects.data]);
  const activeSearch = tab === "people" ? people : tab === "pages" ? pages : tab === "projects" ? projects : tab === "posts" ? posts : people;
  const refreshing = suggestions.isRefetching || suggestedPages.isRefetching || categories.isRefetching || (isSearching && activeSearch.isRefetching);
  const refresh = () => { void suggestions.refetch(); void suggestedPages.refetch(); void categories.refetch(); if (isSearching) { void people.refetch(); void pages.refetch(); void posts.refetch(); void projects.refetch(); } };
  const identityName = identity.data?.mode === "page" ? identity.data.page.name : profile?.display_name ?? "AKọ"; const identityAvatar = identity.data?.mode === "page" ? identity.data.page.avatar_url : profile?.avatar_url;

  const { scrollHandler } = useFeedChrome();
  const chromeStyle = useFeedChromeStyle(-64);

  return <ProbationalLock featureKey="probational_discover_enabled"><SafeAreaView edges={["top", "left", "right"]} style={[s.root, { backgroundColor: colors.background }]}>
    <Animated.ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} onScroll={scrollHandler} scrollEventThrottle={16} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />} contentContainerStyle={s.content}>
      <View style={[s.search, { backgroundColor: colors.surface, borderColor: colors.border }]}><Icon name="search" size={19} color={colors.textMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search people, pages, posts…" placeholderTextColor={colors.textMuted} selectionColor={colors.accent} autoCapitalize="none" returnKeyType="search" style={[s.input, { color: colors.text }]} />{query.length > 0 && <Pressable accessibilityLabel="Clear search" onPress={() => setQuery("")}><Icon name="x" size={19} color={colors.textMuted} /></Pressable>}</View>
      {isSearching ? <SearchResultsTabs tab={tab} setTab={setTab} people={people} peopleResults={peopleResults} pages={pages} pagesResults={pagesResults} posts={posts} projects={projects} projectsResults={projectsResults} /> : <><View style={s.section}><Text variant="title" style={s.sectionTitle}>People to follow</Text><Text color="secondary" style={s.sectionSubtitle}>{pageId ? "Based on this page's network and activity." : "Based on your network and activity."}</Text>{suggestions.isLoading ? <Loading label="Loading…" /> : suggestions.isError ? <ErrorState message="Couldn't load suggestions." onRetry={() => void suggestions.refetch()} /> : suggestions.data?.length ? suggestions.data.map((person) => <PersonResult key={person.id} person={person} />) : <Empty label="No suggestions right now." />}</View>
        <View style={s.section}><Text variant="title" style={s.sectionTitle}>Pages to follow</Text><Text color="secondary" style={s.sectionSubtitle}>Organisations, brands and products worth a look.</Text>{suggestedPages.isLoading ? <Loading label="Loading…" /> : suggestedPages.isError ? <ErrorState message="Couldn't load pages." onRetry={() => void suggestedPages.refetch()} /> : suggestedPages.data?.length ? suggestedPages.data.map((page) => <PageResult key={page.id} page={page} />) : <Empty label="No pages to suggest right now." />}</View>
        <View style={s.section}><Text variant="title" style={s.sectionTitle}>Topics</Text><Text color="secondary" style={s.sectionSubtitle}>Explore by what you care about.</Text>{categories.isLoading ? <Loading label="Loading…" /> : categories.isError ? <ErrorState message="Couldn't load topics." onRetry={() => void categories.refetch()} /> : categories.data?.map((category) => { const open = openCategory === category.id; return <View key={category.id} style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}><Pressable onPress={() => setOpenCategory(open ? null : category.id)} style={s.category}><Text style={s.categoryName}>{category.name}</Text><Icon name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} /></Pressable>{open && <View style={s.interests}>{category.interests.map((interest) => <Pressable key={interest.id} onPress={() => router.push({ pathname: "/(tabs)/home", params: { interest: interest.id } })} style={[s.interest, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={s.interestText}>{interest.name}</Text></Pressable>)}</View>}</View>; })}</View></>}
    </Animated.ScrollView>
    <Animated.View pointerEvents="box-none" style={[s.topHeader, { borderBottomColor: colors.border }, chromeStyle]}>
      <View style={[StyleSheet.absoluteFill, s.topHeaderClip]}><BlurView intensity={isDark ? 32 : 44} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /><View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, opacity: 0.8 }]} /></View>
      <Pressable accessibilityLabel="Open profile" onPress={() => router.push("/(tabs)/profile")}><Avatar uri={identityAvatar} name={identityName} size={34} /></Pressable>
      <Image accessibilityLabel="AKọ" source={wordmarks[isDark ? "dark" : "light"]} style={s.logo} contentFit="contain" />
      <Pressable accessibilityLabel="Open notifications" onPress={() => router.push("/(tabs)/notifications")} style={s.bell}><Icon name="bell" size={22} color={colors.textSecondary} />{unread > 0 && <View style={[s.badge, { backgroundColor: colors.danger }]}><Text style={s.badgeText}>{unread > 9 ? "9+" : unread}</Text></View>}</Pressable>
    </Animated.View>
  </SafeAreaView></ProbationalLock>;
}

function SearchResultsTabs({ tab, setTab, people, peopleResults, pages, pagesResults, posts, projects, projectsResults }: { tab: SearchTab; setTab: (tab: SearchTab) => void; people: ReturnType<typeof useSearchPeople>; peopleResults: Person[]; pages: ReturnType<typeof useSearchPages>; pagesResults: Page[]; posts: ReturnType<typeof useSearchPosts>; projects: ReturnType<typeof useSearchProjects>; projectsResults: Project[] }) {
  const { colors } = useTheme();
  const postsData = posts.data ?? [];
  // "All": show only sections that have something, so a query that only matches a page doesn't render three empty headings above it.
  const settled = !people.isLoading && !pages.isLoading && !posts.isLoading && !projects.isLoading;
  const allEmpty = settled && !peopleResults.length && !postsData.length && !pagesResults.length && !projectsResults.length;

  return <View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.searchTabsScroll, { borderBottomColor: colors.border }]}>{SEARCH_TABS.map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[s.searchTab, tab === item && { borderBottomColor: colors.accent }]}><Text style={{ color: tab === item ? colors.accent : colors.textMuted, fontWeight: "600" }}>{TAB_LABEL[item]}</Text></Pressable>)}</ScrollView>

    {tab === "people" && (people.isLoading ? <Loading label="Searching…" /> : people.isError ? <ErrorState message="Search failed." onRetry={() => void people.refetch()} /> : peopleResults.length ? peopleResults.map((p) => <PersonResult key={p.id} person={p} />) : <Empty label="No people found." />)}
    {tab === "pages" && (pages.isLoading ? <Loading label="Searching…" /> : pages.isError ? <ErrorState message="Search failed." onRetry={() => void pages.refetch()} /> : pagesResults.length ? pagesResults.map((p) => <PageResult key={p.id} page={p} />) : <Empty label="No pages found." />)}
    {tab === "posts" && (posts.isLoading ? <Loading label="Searching…" /> : posts.isError ? <ErrorState message="Search failed." onRetry={() => void posts.refetch()} /> : postsData.length ? <View style={s.posts}>{postsData.map((post) => <PostCard key={post.id} post={post} />)}</View> : <Empty label="No posts found." />)}
    {tab === "projects" && (projects.isLoading ? <Loading label="Searching…" /> : projects.isError ? <ErrorState message="Search failed." onRetry={() => void projects.refetch()} /> : projectsResults.length ? <ProjectGrid projects={projectsResults} /> : <Empty label="No projects found." />)}

    {tab === "all" && (allEmpty ? <Empty label="No results found." /> : <>
      {(people.isLoading || peopleResults.length > 0 || people.isError) && <View style={s.previewSection}><View style={s.previewHeader}><Text variant="title" style={s.previewTitle}>People</Text>{peopleResults.length > PREVIEW_COUNT && <Pressable onPress={() => setTab("people")}><Text color="accent" style={s.seeAll}>See all</Text></Pressable>}</View>{people.isLoading ? <Loading label="Searching…" /> : people.isError ? <ErrorState message="Search failed." onRetry={() => void people.refetch()} /> : peopleResults.slice(0, PREVIEW_COUNT).map((p) => <PersonResult key={p.id} person={p} />)}</View>}
      {(pages.isLoading || pagesResults.length > 0 || pages.isError) && <View style={s.previewSection}><View style={s.previewHeader}><Text variant="title" style={s.previewTitle}>Pages</Text>{pagesResults.length > PREVIEW_COUNT && <Pressable onPress={() => setTab("pages")}><Text color="accent" style={s.seeAll}>See all</Text></Pressable>}</View>{pages.isLoading ? <Loading label="Searching…" /> : pages.isError ? <ErrorState message="Search failed." onRetry={() => void pages.refetch()} /> : pagesResults.slice(0, PREVIEW_COUNT).map((p) => <PageResult key={p.id} page={p} />)}</View>}
      {(projects.isLoading || projectsResults.length > 0 || projects.isError) && <View style={s.previewSection}><View style={s.previewHeader}><Text variant="title" style={s.previewTitle}>Projects</Text>{projectsResults.length > PREVIEW_COUNT && <Pressable onPress={() => setTab("projects")}><Text color="accent" style={s.seeAll}>See all</Text></Pressable>}</View>{projects.isLoading ? <Loading label="Searching…" /> : projects.isError ? <ErrorState message="Search failed." onRetry={() => void projects.refetch()} /> : <ProjectGrid projects={projectsResults.slice(0, PREVIEW_COUNT)} />}</View>}
      {(posts.isLoading || postsData.length > 0 || posts.isError) && <View style={s.previewSection}><View style={s.previewHeader}><Text variant="title" style={s.previewTitle}>Posts</Text>{postsData.length > PREVIEW_COUNT && <Pressable onPress={() => setTab("posts")}><Text color="accent" style={s.seeAll}>See all</Text></Pressable>}</View>{posts.isLoading ? <Loading label="Searching…" /> : posts.isError ? <ErrorState message="Search failed." onRetry={() => void posts.refetch()} /> : <View style={s.posts}>{postsData.slice(0, PREVIEW_COUNT).map((post) => <PostCard key={post.id} post={post} />)}</View>}</View>}
    </>)}
  </View>;
}

function Loading({ label }: { label: string }) { const { colors } = useTheme(); return <View style={s.status}><ActivityIndicator color={colors.accent} /><Text color="muted">{label}</Text></View>; }
function Empty({ label }: { label: string }) { return <Text color="muted" align="center" style={s.empty}>{label}</Text>; }

const s = StyleSheet.create({ root: { flex: 1 }, topHeader: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, height: 64, borderBottomWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, topHeaderClip: { overflow: "hidden" }, logo: { width: 71, height: 36 }, bell: { width: 36, height: 36, alignItems: "center", justifyContent: "center" }, badge: { position: "absolute", right: 0, top: 0, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, alignItems: "center", justifyContent: "center" }, badgeText: { color: "white", fontSize: 10, lineHeight: 12, fontWeight: "700" }, content: { paddingHorizontal: 16, paddingTop: 16 + 64, paddingBottom: 36 }, search: { height: 48, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 24 }, input: { flex: 1, height: 46, padding: 0, fontSize: 14 }, section: { marginBottom: 28 }, sectionTitle: { fontSize: 21, lineHeight: 27 }, sectionSubtitle: { fontSize: 14, lineHeight: 19, marginTop: 2, marginBottom: 12 }, row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth }, rowCopy: { flex: 1, minWidth: 0 }, rowName: { fontSize: 14, lineHeight: 19, fontWeight: "700" }, pageNameRow: { flexDirection: "row", alignItems: "center", gap: 5 }, meta: { fontSize: 12, lineHeight: 17 }, followers: { fontSize: 12, lineHeight: 17, flexShrink: 0 }, searchTabsScroll: { flexGrow: 0, borderBottomWidth: 1, marginBottom: 3 }, searchTab: { paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: "transparent" }, posts: { gap: 14, marginHorizontal: -16, paddingTop: 12 }, projectGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 4 }, previewSection: { marginBottom: 24 }, previewHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 2 }, previewTitle: { fontSize: 16, lineHeight: 21 }, seeAll: { fontSize: 14, fontWeight: "600", paddingVertical: 4 }, status: { minHeight: 90, alignItems: "center", justifyContent: "center", gap: 8 }, empty: { paddingVertical: 34 }, category: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, categoryName: { fontSize: 16, lineHeight: 21, fontWeight: "600" }, interests: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 16 }, interest: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }, interestText: { fontSize: 14, lineHeight: 18 } });

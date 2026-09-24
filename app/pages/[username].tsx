// File: app/pages/[username].tsx
//
// A page's public profile. Mirrors web's PagePage (06139cc): Posts/Projects
// tabs, the Posts tab backed by the same posted_as_page_id timeline query
// used everywhere else (useIdentityPosts "page" — see features/discovery/api,
// which already excludes these posts from the posting member's own personal
// timeline), the Projects tab backed by the get_page_projects RPC
// (usePageProjects — see supabase/ako_page_projects_listing.sql on web).
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Avatar, Button, PressableScale, Screen, Text, VerifiedBadge } from "@/components/core";
import { ErrorState, OfflineState, Skeleton } from "@/components/feedback";
import { getScreenState } from "@/lib/screenState";
import { PostCard } from "@/components/feed/PostCard";
import { ProjectMiniGrid } from "@/components/projects/ProjectMiniCard";
import { usePage, usePageFollow, useIdentityPosts, useTogglePageFollow } from "@/features/discovery/api";
import { useMyPages } from "@/features/pages/api";
import { usePageProjects } from "@/features/projects/api";
import { useTheme } from "@/providers/ThemeProvider";

type Tab = "posts" | "projects";

export default function PageProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>("posts");

  const page = usePage(typeof username === "string" ? username : "");
  const follow = usePageFollow(page.data?.id ?? "");
  const toggle = useTogglePageFollow(page.data?.id ?? "");
  const posts = useIdentityPosts(page.data?.id ?? "", "page");
  const projects = usePageProjects(page.data?.id);
  const myPages = useMyPages();
  const isMember = !!myPages.data?.some((mine) => mine.id === page.data?.id);

  if (page.isLoading) return <Screen><Skeleton height={220} /></Screen>;
  if (getScreenState(page) === "offline") return <Screen><OfflineState onRetry={() => void page.refetch()} /></Screen>;
  if (page.isError || !page.data) return <Screen><ErrorState message="Page unavailable." onRetry={() => void page.refetch()} /></Screen>;
  const p = page.data;
  const projectRows = projects.data ?? [];
  const postRows = posts.data?.pages.flat() ?? [];

  const header = (
    <View>
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
      <View style={{ alignItems: "center", gap: 10, paddingVertical: 16 }}>
        <Avatar uri={p.avatar_url} name={p.name} size={88} />
        <View style={{ alignItems: "center" }}>
          <Text variant="title">{p.name}</Text>
          <Text color="secondary">@{p.username} · {p.page_type}</Text>
        </View>
        {p.is_verified && <VerifiedBadge label />}
        {p.tagline && <Text variant="label" align="center">{p.tagline}</Text>}
        {p.bio && <Text align="center">{p.bio}</Text>}
        <Text color="secondary">{p.follower_count} followers</Text>
        <Button label={follow.data ? "Following" : "Follow"} variant={follow.data ? "secondary" : "primary"} loading={follow.isLoading || toggle.isPending} onPress={() => void toggle.mutateAsync(!!follow.data).catch(() => Alert.alert("Couldn't update page follow"))} />
      </View>
      <View style={{ flexDirection: "row", gap: 24, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: colors.border }}>
        {(["posts", "projects"] as const).map((t) => (
          <PressableScale key={t} onPress={() => setTab(t)} style={{ paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: tab === t ? colors.accent : "transparent" }}>
            <Text style={{ color: tab === t ? colors.accent : colors.textMuted, fontWeight: "600" }}>
              {t === "posts" ? "Posts" : "Projects"}
              {t === "projects" && projectRows.length > 0 ? <Text color="muted" style={{ fontSize: 12 }}> {projectRows.length}</Text> : null}
            </Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );

  if (tab === "projects") {
    return (
      <Screen scroll contentStyle={{ paddingHorizontal: 0 }}>
        {header}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          {getScreenState(projects) === "offline" ? (
            <OfflineState onRetry={() => void projects.refetch()} />
          ) : projects.isLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 34 }} />
          ) : projectRows.length === 0 ? (
            <Text color="muted" align="center" style={{ paddingVertical: 45, paddingHorizontal: 12 }}>
              {isMember ? `No projects yet — switch to ${p.name} and tap + to publish the first one.` : `${p.name} hasn't published any projects yet.`}
            </Text>
          ) : (
            <ProjectMiniGrid projects={projectRows} showStatus={isMember} />
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
      <FlatList
        data={postRows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <View style={{ paddingHorizontal: 18 }}><PostCard post={item} /></View>}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 28 }}
        onEndReached={() => { if (posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        refreshing={posts.isRefetching}
        onRefresh={() => { void page.refetch(); void posts.refetch(); }}
        ListEmptyComponent={getScreenState(posts) === "offline" ? <OfflineState onRetry={() => void posts.refetch()} /> : posts.isLoading ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 34 }} /> : <Text color="muted" align="center" style={{ paddingVertical: 45 }}>{p.name} hasn't posted anything yet.</Text>}
        ListFooterComponent={posts.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 18 }} /> : null}
      />
    </Screen>
  );
}

import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Platform, Pressable, Share, StyleSheet, TextInput, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import { Avatar, Text } from "@/components/core";
import { ErrorState, Skeleton } from "@/components/feedback";
import { PostCard } from "@/components/feed/PostCard";
import { type Person, type ProfileMedia, useFollowState, useIdentityPosts, useProfile, useProfileMedia, useToggleFollow } from "@/features/discovery/api";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

type Tab = "posts" | "media";

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const name = typeof username === "string" ? username : "";
  const { user } = useAuth();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>("posts");
  const profile = useProfile(name);
  const person = profile.data;
  const state = useFollowState(person?.id ?? "");
  const toggle = useToggleFollow(person ?? ({ id: "", username: "", is_private: false } as Person));
  const own = person?.id === user?.id;
  const locked = !!person?.is_private && !own && !state.data?.following;
  const posts = useIdentityPosts(locked ? "" : person?.id ?? "", "profile");
  const media = useProfileMedia(person?.id ?? "", !locked);

  if (profile.isLoading) return <SafeAreaView style={[s.root, { backgroundColor: colors.background }]}><View style={s.loading}><Skeleton height={220} /><Skeleton height={360} /></View></SafeAreaView>;
  if (profile.isError || !person) return <SafeAreaView style={[s.root, { backgroundColor: colors.background }]}><ErrorState message="Profile unavailable." onRetry={() => void profile.refetch()} /></SafeAreaView>;

  const label = state.data?.following ? "Following" : state.data?.requested ? "Requested" : "Follow";
  const postRows = posts.data?.pages.flat() ?? [];
  const follow = () => void toggle.mutateAsync(state.data ?? { following: false, requested: false }).catch(() => Alert.alert("Couldn't update follow state"));
  const showMediaTab = (media.data?.length ?? 0) > 0;
  const header = <ProfileHeader person={person} own={own} locked={locked} showMediaTab={showMediaTab} tab={showMediaTab ? tab : "posts"} setTab={setTab} followLabel={label} following={!!state.data?.following || !!state.data?.requested} followPending={state.isLoading || toggle.isPending} onFollow={follow} />;

  return <SafeAreaView edges={["top", "left", "right"]} style={[s.root, { backgroundColor: colors.background }]}>
    {tab === "posts" ? <FlatList data={locked ? [] : postRows} renderItem={({ item }) => <View style={s.postWrap}><PostCard post={item} /></View>} keyExtractor={(item) => item.id} ListHeaderComponent={header} contentContainerStyle={s.list} ItemSeparatorComponent={() => <View style={{ height: 14 }} />} onEndReached={() => { if (posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage(); }} onEndReachedThreshold={.5} refreshing={posts.isRefetching} onRefresh={() => { void profile.refetch(); if (!locked) void posts.refetch(); }} ListEmptyComponent={locked ? <PrivateState /> : posts.isLoading ? <ActivityIndicator color={colors.accent} style={s.indicator} /> : <Empty label="No posts yet." />} ListFooterComponent={posts.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={s.indicator} /> : <View style={{ height: 18 }} />} /> : <FlatList data={locked ? [] : media.data ?? []} renderItem={({ item }) => <MediaCard item={item} />} keyExtractor={(item) => item.id} ListHeaderComponent={header} contentContainerStyle={s.list} ItemSeparatorComponent={() => <View style={{ height: 14 }} />} refreshing={media.isRefetching} onRefresh={() => { void profile.refetch(); if (!locked) void media.refetch(); }} ListEmptyComponent={locked ? <PrivateState /> : media.isLoading ? <ActivityIndicator color={colors.accent} style={s.indicator} /> : <Empty label="No media yet." />} />}
    <BottomNavigation />
  </SafeAreaView>;
}

function ProfileHeader({ person, own, locked, showMediaTab, tab, setTab, followLabel, following, followPending, onFollow }: { person: Person; own: boolean; locked: boolean; showMediaTab: boolean; tab: Tab; setTab: (tab: Tab) => void; followLabel: string; following: boolean; followPending: boolean; onFollow: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [relationshipOpen, setRelationshipOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const domain = person.website_url?.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
  const profileUrl = `https://ako.app/profile/${person.username}`;
  const showMore = () => setShareOpen(true);

  return <>
    <View style={s.toolbar}>
      {own || following ? <View style={{ flex: 1 }} /> : <Pressable onPress={() => router.push("/(tabs)/inbox")} style={[s.messageButton, { borderColor: colors.border }]}><Feather name="message-square" size={16} color={colors.textSecondary} /><Text color="secondary" style={s.actionText}>Message</Text></Pressable>}
      {own ? <Pressable onPress={() => router.push("/profile/edit")} style={[s.messageButton, { borderColor: colors.border }]}><Text color="secondary" style={s.actionText}>Edit profile</Text></Pressable> : <Pressable disabled={followPending} onPress={() => following ? setRelationshipOpen(true) : onFollow()} style={[s.followButton, { backgroundColor: following ? colors.accentSoft : colors.surfaceElevated, opacity: followPending ? .55 : 1 }]}>{followPending ? <ActivityIndicator size="small" color={colors.accent} /> : <View style={s.followContent}>{following ? <Feather name="user-check" size={14} color={colors.accent} /> : null}<Text style={[s.actionText, { color: following ? colors.accent : colors.text }]}>{followLabel}</Text>{following ? <Feather name="chevron-down" size={14} color={colors.accent} /> : null}</View>}</Pressable>}
      <Pressable accessibilityLabel="More options" onPress={showMore} style={s.more}><Feather name="more-horizontal" size={18} color={colors.textSecondary} /></Pressable>
    </View>
    <RelationshipMenu visible={relationshipOpen} person={person} onClose={() => setRelationshipOpen(false)} onMessage={() => { setRelationshipOpen(false); router.push("/(tabs)/inbox"); }} onUnfollow={() => { setRelationshipOpen(false); onFollow(); }} />
    <ShareProfileSheet visible={shareOpen} person={person} url={profileUrl} onClose={() => setShareOpen(false)} />

    <View style={s.identity}>
      <Avatar uri={person.avatar_url} name={person.display_name} size={64} />
      <View style={s.identityCopy}>
        <View style={s.nameRow}><Text style={s.name}>{person.display_name}</Text>{person.is_verified ? <MaterialCommunityIcons name="check-decagram" size={18} color={colors.accent} /> : null}</View>
        {person.roles?.length ? <Text numberOfLines={2} color="secondary" style={s.roles}>{person.roles.map((role) => role.label).join(" · ")}</Text> : null}
        <View style={s.handleRow}><Text color="secondary" style={s.handle}>@{person.username}</Text>{domain ? <><Text color="secondary" style={s.handle}> / </Text><Pressable onPress={() => void Linking.openURL(/^https?:\/\//i.test(person.website_url!) ? person.website_url! : `https://${person.website_url}`)}><Text color="accent" style={s.handle}>◎ {domain}</Text></Pressable></> : null}</View>
      </View>
    </View>

    {person.bio ? <Text style={s.bio}>{person.bio}</Text> : null}
    <View style={s.stats}>
      <Pressable onPress={() => router.push({ pathname: "/profiles/[username]/[list]", params: { username: person.username, list: "following" } })}><Text style={s.statNumber}>{person.following_count} <Text color="secondary" style={s.statLabel}>Following</Text></Text></Pressable>
      <Pressable onPress={() => router.push({ pathname: "/profiles/[username]/[list]", params: { username: person.username, list: "followers" } })}><Text style={s.statNumber}>{person.follower_count} <Text color="secondary" style={s.statLabel}>Followers</Text></Text></Pressable>
    </View>
    {!locked ? <View style={[s.tabs, { borderBottomColor: colors.border }]}><Pressable onPress={() => setTab("posts")} style={s.tab}><Text style={[s.tabText, { color: tab === "posts" ? colors.accent : colors.textMuted }]}>Posts</Text>{tab === "posts" ? <View style={[s.tabLine, { backgroundColor: colors.accent }]} /> : null}</Pressable>{showMediaTab ? <Pressable onPress={() => setTab("media")} style={s.tab}><Text style={[s.tabText, { color: tab === "media" ? colors.accent : colors.textMuted }]}>Media</Text>{tab === "media" ? <View style={[s.tabLine, { backgroundColor: colors.accent }]} /> : null}</Pressable> : null}</View> : null}
  </>;
}

function MediaCard({ item }: { item: ProfileMedia }) {
  const { colors } = useTheme();
  const details = Array.isArray(item.media_details) ? item.media_details[0] : item.media_details;
  const preview = details?.video_url || details?.audio_url;
  const effectivePrice = item.promo_price_usd ?? item.price_usd;
  const play = () => { if (preview) void Linking.openURL(preview); else Alert.alert(item.title, "A playable preview isn't available for this media yet."); };
  return <View style={[s.mediaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={s.mediaHero}>{item.thumbnail_url ? <Image source={{ uri: item.thumbnail_url }} style={s.mediaImage} contentFit="cover" /> : <View style={[s.mediaImage, s.mediaFallback, { backgroundColor: colors.accentSoft }]}><MaterialCommunityIcons name="image-outline" size={38} color={colors.textMuted} /></View>}<Pressable accessibilityLabel={`Play ${item.title}`} onPress={play} style={({ pressed }) => [s.play, { backgroundColor: "rgba(235,229,219,.86)", opacity: pressed ? .72 : 1 }]}><MaterialCommunityIcons name="play" size={31} color="#11110F" style={{ marginLeft: 3 }} /></Pressable></View><View style={s.mediaCopy}><View style={s.mediaTitleRow}><Text numberOfLines={1} style={s.mediaTitle}>{item.title}</Text><View style={[s.pricePill, { backgroundColor: colors.accentSoft }]}><Text color="accent" style={s.priceText}>{effectivePrice <= 0 ? "Free" : `$${effectivePrice.toFixed(2)}`}</Text></View></View><Text color="secondary" style={s.mediaType}>Media</Text>{item.description ? <Text color="secondary" numberOfLines={2} style={s.mediaDescription}>{item.description}</Text> : null}</View></View>;
}

function RelationshipMenu({ visible, person, onClose, onMessage, onUnfollow }: { visible: boolean; person: Person; onClose: () => void; onMessage: () => void; onUnfollow: () => void }) {
  const { colors } = useTheme();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><Pressable onPress={onClose} style={s.overlay}><View style={[s.relationshipMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}><Pressable onPress={onMessage} style={s.relationRow}><Feather name="send" size={22} color={colors.text} /><Text style={s.relationText}>Message</Text></Pressable><Pressable onPress={onClose} style={s.relationRow}><Feather name="bell-off" size={22} color={colors.text} /><Text style={s.relationText}>Mute their updates</Text></Pressable><View style={[s.relationDivider, { backgroundColor: colors.border }]} /><Pressable onPress={onUnfollow} accessibilityLabel={`Unfollow ${person.display_name}`} style={s.relationRow}><Feather name="user-minus" size={22} color={colors.danger} /><Text style={[s.relationText, { color: colors.danger }]}>Unfollow</Text></Pressable></View></Pressable></Modal>;
}

function ShareProfileSheet({ visible, person, url, onClose }: { visible: boolean; person: Person; url: string; onClose: () => void }) {
  const { colors } = useTheme();
  const share = () => void Share.share({ message: url, url });
  const actions = [
    { label: "WhatsApp", icon: "phone-call", color: "#45D765", onPress: share },
    { label: "Copy link", icon: "link", color: colors.surfaceElevated, onPress: share },
    { label: "SMS", icon: "message-square", color: "#45D765", onPress: share },
    { label: "Email", icon: "mail", color: "#D4D4D0", onPress: share },
    { label: "Facebook", icon: "facebook", color: "#2F7CF6", onPress: share },
  ] as const;
  const tools = [
    { label: "Customise\nname", icon: "edit-3", color: colors.surfaceElevated },
    { label: "Report", icon: "flag", color: colors.surfaceElevated },
    { label: "Report a\npost/project", icon: "alert-circle", color: colors.surfaceElevated },
    { label: "Mute their\nupdates", icon: "bell-off", color: colors.surfaceElevated },
    { label: "Block", icon: "slash", color: colors.surfaceElevated, danger: true },
    { label: "QR code", icon: "grid", color: colors.surfaceElevated },
  ] as const;
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={s.shareOverlay}><Pressable onPress={onClose} style={StyleSheet.absoluteFill} /><View style={[s.shareSheet, { backgroundColor: colors.background, borderColor: colors.border }]}><View style={s.sheetTitleRow}><View style={{ width: 24 }} /><Text style={s.sheetTitle}>Send to</Text><Pressable onPress={onClose} style={s.sheetClose}><Feather name="x" size={22} color={colors.textSecondary} /></Pressable></View><View style={[s.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}><Feather name="search" size={16} color={colors.textMuted} /><TextInput placeholder="Search" placeholderTextColor={colors.textMuted} style={[s.searchInput, { color: colors.text }]} /></View><View style={s.recipientRow}><Avatar uri={person.avatar_url} name={person.display_name} size={54} /><Text numberOfLines={1} style={s.recipientName}>{person.display_name}</Text></View><View style={[s.sheetDivider, { backgroundColor: colors.border }]} /><View style={s.actionRow}>{actions.map(action => <Pressable key={action.label} onPress={action.onPress} style={s.shareAction}><View style={[s.actionCircle, { backgroundColor: action.color }]}><Feather name={action.icon as any} size={20} color={action.color === "#D4D4D0" ? "#11110F" : "#FFFFFF"} /></View><Text color="secondary" align="center" style={s.actionLabel}>{action.label}</Text></Pressable>)}</View><View style={[s.sheetDivider, { backgroundColor: colors.border }]} /><View style={s.toolGrid}>{tools.map(tool => { const danger = "danger" in tool && tool.danger; return <Pressable key={tool.label} onPress={danger ? undefined : share} style={s.toolItem}><View style={[s.toolCircle, { backgroundColor: tool.color }]}><Feather name={tool.icon as any} size={20} color={danger ? colors.danger : colors.text} /></View><Text align="center" style={[s.toolLabel, { color: danger ? colors.danger : colors.text }]}>{tool.label}</Text></Pressable>; })}</View></View></View></Modal>;
}

function PrivateState() {
  const { colors } = useTheme();
  return <View style={s.private}><View style={[s.lock, { backgroundColor: colors.accentSoft }]}><MaterialCommunityIcons name="lock-outline" size={25} color={colors.accent} /></View><Text variant="heading">This account is private</Text><Text color="secondary" align="center">Follow this account to see their posts and media.</Text></View>;
}

function Empty({ label }: { label: string }) {
  return <Text color="muted" align="center" style={s.empty}>{label}</Text>;
}

function FeedIcon({ color }: { color: string }) {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 11.5 12 4l9 7.5" /><Path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" /></Svg>;
}

function LibraryIcon({ color }: { color: string }) {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><Rect width={8} height={18} x={3} y={3} rx={1} /><Path d="M7 3v18" /><Path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z" /></Svg>;
}

function BottomNavigation() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "android" ? Math.max(insets.bottom, 34) : insets.bottom;
  const items = [
    { label: "Feed", onPress: () => router.push("/(tabs)/home"), icon: <FeedIcon color={colors.textMuted} /> },
    { label: "Discover", onPress: () => router.push("/(tabs)/discover"), icon: <Feather name="search" size={24} color={colors.textMuted} strokeWidth={1.75} /> },
    { label: "Library", onPress: () => router.push("/(tabs)/create"), icon: <LibraryIcon color={colors.textMuted} /> },
    { label: "Messages", onPress: () => router.push("/(tabs)/inbox"), icon: <Feather name="message-circle" size={24} color={colors.textMuted} strokeWidth={1.75} /> },
    { label: "Profile", onPress: () => router.push("/(tabs)/profile"), icon: <Feather name="user" size={24} color={colors.textMuted} strokeWidth={1.75} /> },
  ];
  return <View style={[s.bottomNav, { backgroundColor: colors.surface, borderTopColor: colors.border, height: 76 + bottomInset, paddingBottom: bottomInset }]}>{items.map((item) => <Pressable key={item.label} onPress={item.onPress} style={s.navItem}>{item.icon}<Text color="muted" style={s.navLabel}>{item.label}</Text></Pressable>)}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  loading: { padding: 18, gap: 16 },
  list: { paddingBottom: 88 },
  postWrap: { paddingHorizontal: 18 },
  toolbar: { height: 64, paddingHorizontal: 18, paddingTop: 10, flexDirection: "row", alignItems: "flex-start", justifyContent: "flex-end", gap: 8 },
  messageButton: { height: 42, minWidth: 126, borderRadius: 21, borderWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  followButton: { minWidth: 91, height: 42, paddingHorizontal: 19, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  followContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  actionText: { fontSize: 16, lineHeight: 20, fontWeight: "700" },
  more: { width: 30, height: 42, alignItems: "center", justifyContent: "center" },
  identity: { paddingHorizontal: 18, paddingTop: 16, flexDirection: "row", alignItems: "flex-start", gap: 18 },
  identityCopy: { flex: 1, paddingTop: 7 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  name: { flexShrink: 1, fontSize: 20, lineHeight: 25, fontWeight: "700" },
  roles: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  handleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 1 },
  handle: { fontSize: 16, lineHeight: 21 },
  bio: { paddingHorizontal: 18, marginTop: 16, fontSize: 15, lineHeight: 21 },
  stats: { paddingHorizontal: 18, marginTop: 46, marginBottom: 24, flexDirection: "row", gap: 22 },
  statNumber: { fontSize: 16, lineHeight: 21, fontWeight: "800" },
  statLabel: { fontSize: 16, lineHeight: 21, fontWeight: "400" },
  tabs: { height: 51, flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 18 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", position: "relative" },
  tabText: { fontSize: 16, lineHeight: 20, fontWeight: "700" },
  tabLine: { position: "absolute", height: 2, left: 18, right: 18, bottom: -1, borderRadius: 2 },
  indicator: { marginVertical: 34 },
  empty: { paddingVertical: 45 },
  private: { paddingHorizontal: 34, paddingVertical: 54, alignItems: "center", gap: 10 },
  lock: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  mediaCard: { marginHorizontal: 16, borderWidth: 1, borderRadius: 20, overflow: "hidden" },
  mediaHero: { position: "relative", width: "100%", aspectRatio: .8 },
  mediaImage: { width: "100%", height: "100%" },
  mediaFallback: { alignItems: "center", justifyContent: "center" },
  play: { position: "absolute", left: "50%", top: "50%", width: 56, height: 56, marginLeft: -28, marginTop: -28, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  mediaCopy: { minHeight: 116, paddingHorizontal: 19, paddingTop: 18, paddingBottom: 20, gap: 4 },
  mediaTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  mediaTitle: { flex: 1, fontFamily: Platform.select({ ios: "Georgia", android: "serif" }), fontSize: 19, lineHeight: 25, fontWeight: "700" },
  pricePill: { minWidth: 45, height: 23, borderRadius: 12, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  priceText: { fontSize: 12, lineHeight: 15, fontWeight: "600" },
  mediaType: { fontSize: 12, lineHeight: 17 },
  mediaDescription: { fontSize: 13, lineHeight: 18 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,.62)" },
  relationshipMenu: { position: "absolute", top: 84, right: 62, width: 246, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: .3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  relationRow: { minHeight: 56, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", gap: 18 },
  relationText: { fontSize: 18, lineHeight: 23, fontWeight: "700" },
  relationDivider: { height: StyleSheet.hairlineWidth },
  shareOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,.68)", justifyContent: "flex-end" },
  shareSheet: { minHeight: 570, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingTop: 18 },
  sheetTitleRow: { height: 31, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 16, lineHeight: 21, fontWeight: "700" },
  sheetClose: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  searchBox: { height: 40, marginHorizontal: 18, marginTop: 15, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 9 },
  searchInput: { flex: 1, height: 40, padding: 0, fontSize: 15 },
  recipientRow: { width: 82, marginLeft: 18, marginTop: 14, alignItems: "center", gap: 5 },
  recipientName: { width: 82, fontSize: 12, lineHeight: 15, fontWeight: "700" },
  sheetDivider: { height: StyleSheet.hairlineWidth, marginTop: 18 },
  actionRow: { paddingHorizontal: 18, paddingTop: 20, flexDirection: "row", gap: 24 },
  shareAction: { width: 64, alignItems: "center", gap: 8 },
  actionCircle: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 12, lineHeight: 16 },
  toolGrid: { paddingHorizontal: 22, paddingTop: 20, flexDirection: "row", flexWrap: "wrap", rowGap: 24, columnGap: 31 },
  toolItem: { width: 64, alignItems: "center", gap: 7 },
  toolCircle: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  toolLabel: { fontSize: 12, lineHeight: 15, fontWeight: "700" },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, height: 76, borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", flexDirection: "row", paddingTop: 13 },
  navItem: { flex: 1, alignItems: "center", gap: 5 },
  navLabel: { fontSize: 11, lineHeight: 14, fontWeight: "500" },
});

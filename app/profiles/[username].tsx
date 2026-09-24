import { useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from "react-native";
import { Icon, type IconName } from "@/components/core/Icon";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { interpolate, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import { Avatar, Button, FacebookGlyph, MediaViewer, Text, VerifiedBadge, WhatsAppGlyph, XGlyph } from "@/components/core";
import { ConfirmDialog, ErrorState, OfflineState, Skeleton } from "@/components/feedback";
import { getScreenState } from "@/lib/screenState";
import { PostCard } from "@/components/feed/PostCard";
import { TierBadge } from "@/components/profile/TierBadge";
import { type Person, type ProfileMedia, useCachedProfile, useFollowState, useIdentityPosts, useProfile, useProfileMedia, useToggleFollow } from "@/features/discovery/api";
import {
  type ReportReason,
  useContactNickname,
  useIsBlocked,
  useIsMuted,
  useRecordProfileVisit,
  useRemoveFollower,
  useReportReasons,
  useSetContactNickname,
  useSubmitReport,
  useToggleBlock,
  useToggleMute,
} from "@/features/profile/relationship";
import type { Post } from "@/features/feed/types";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useProbationalLock } from "@/features/account/probational";

type Tab = "posts" | "media";
// Toolbar (Message/Follow/⋯) is its own absolute overlay above the list, not
// a list row — it fades away once the identity block has scrolled past (see
// toolbarStyle below), the same collapse behavior as the owner's own profile
// screen (app/(tabs)/profile.tsx) and web's ProfilePage. The tab bar is a
// real row (index 1) kept pinned the whole time via stickyHeaderIndices, so
// once the toolbar is gone it's the only thing left docked at the top —
// again matching both of those.
const TOOLBAR_HEIGHT = 64;
type Row =
  | { type: "identity" }
  | { type: "tabs" }
  | { type: "status"; mode: "loading" | "empty-posts" | "empty-media" | "private" | "blocked" }
  | { type: "post"; id: string; post: Post }
  | { type: "media"; id: string; item: ProfileMedia };

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const name = typeof username === "string" ? username : "";
  const { user } = useAuth();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>("posts");
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [unfollowConfirmOpen, setUnfollowConfirmOpen] = useState(false);
  const [removeFollowerConfirmOpen, setRemoveFollowerConfirmOpen] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const listRef = useRef<FlatList<Row>>(null);

  const profile = useProfile(name);
  const person = profile.data;
  const cachedProfile = useCachedProfile(name, getScreenState(profile) === "offline");
  const state = useFollowState(person?.id ?? "");
  const toggle = useToggleFollow(person ?? ({ id: "", username: "", is_private: false } as Person));
  const own = person?.id === user?.id;
  const locked = !!person?.is_private && !own && !state.data?.following;

  const isBlockedQuery = useIsBlocked(own ? "" : person?.id ?? "");
  const isBlocked = !!isBlockedQuery.data;
  const toggleBlock = useToggleBlock(person?.id ?? "");
  const isMutedQuery = useIsMuted(own ? "" : person?.id ?? "");
  const isMuted = !!isMutedQuery.data;
  const toggleMute = useToggleMute(person?.id ?? "");
  const removeFollower = useRemoveFollower(person?.id ?? "");
  const { data: nickname } = useContactNickname(own ? "" : person?.id ?? "");
  useRecordProfileVisit(own ? undefined : person?.id);

  const posts = useIdentityPosts(locked || isBlocked ? "" : person?.id ?? "", "profile");
  const media = useProfileMedia(person?.id ?? "", !locked && !isBlocked);

  const headerHeight = useSharedValue(220);
  const scrollY = useSharedValue(0);
  const showTopValue = useSharedValue(false);
  const toolbarStyle = useAnimatedStyle(() => {
    const start = headerHeight.value;
    const opacity = interpolate(scrollY.value, [start, start + 40], [1, 0], "clamp");
    return { opacity, transform: [{ translateY: interpolate(scrollY.value, [start, start + 40], [0, -TOOLBAR_HEIGHT], "clamp") }] };
  });
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = Math.max(0, event.contentOffset.y);
      // eslint-disable-next-line react-hooks/immutability
      scrollY.value = y;
      const next = y > 480;
      if (next !== showTopValue.value) {
        showTopValue.value = next;
        runOnJS(setShowTop)(next);
      }
    },
  });

  if (getScreenState(profile) === "offline") return <OfflineProfile cached={cachedProfile.data ?? null} onRetry={() => void profile.refetch()} />;
  if (profile.isLoading) return <SafeAreaView style={[s.root, { backgroundColor: colors.background }]}><View style={s.loading}><Skeleton height={220} /><Skeleton height={360} /></View></SafeAreaView>;
  if (profile.isError || !person) return <SafeAreaView style={[s.root, { backgroundColor: colors.background }]}><ErrorState message="Profile unavailable." onRetry={() => void profile.refetch()} /></SafeAreaView>;

  const label = state.data?.following ? "Following" : state.data?.requested ? "Requested" : "Follow";
  const postRows = posts.data?.pages.flat() ?? [];
  const displayName = nickname || person.display_name;
  const doFollow = () => void toggle.mutateAsync(state.data ?? { following: false, requested: false }).catch(() => Alert.alert("Couldn't update follow state"));

  // Mirrors web: unfollowing someone who follows you back, or a
  // private account, loses you access/visibility you may not get
  // back on request — worth a confirm. A plain public follow with no
  // follow-back doesn't need one.
  function startUnfollow() {
    if (state.data?.followedBy || person!.is_private) {
      setUnfollowConfirmOpen(true);
      return;
    }
    doFollow();
  }
  function confirmUnfollow() {
    doFollow();
    setUnfollowConfirmOpen(false);
  }
  function confirmRemoveFollower() {
    removeFollower.mutate(undefined, {
      onSuccess: () => setRemoveFollowerConfirmOpen(false),
      onError: () => Alert.alert("Couldn't remove that follower — try again."),
    });
  }
  function handleToggleBlock() {
    if (isBlocked) {
      toggleBlock.mutate(true, { onError: () => Alert.alert("Couldn't unblock — try again.") });
      return;
    }
    setBlockConfirmOpen(true);
  }
  function confirmBlock() {
    toggleBlock.mutate(false, {
      onSuccess: () => setBlockConfirmOpen(false),
      onError: () => Alert.alert("Couldn't block — try again."),
    });
  }
  function handleToggleMute() {
    toggleMute.mutate(isMuted, { onError: () => Alert.alert("Couldn't update mute — try again.") });
  }

  const showMediaTab = (media.data?.length ?? 0) > 0;
  const tabs: Tab[] = ["posts", ...(showMediaTab ? (["media"] as const) : [])];
  const tabIndex = tabs.indexOf(tab);

  // Content rows below the (always-present) identity + tabs rows: a
  // blocked/private notice, a loading spinner, an empty message, or the
  // tab's actual items — as rows, not ListEmptyComponent, since `data`
  // here also holds the identity/tabs rows and so is never literally empty.
  const contentLoading = tab === "posts" ? posts.isLoading : media.isLoading;
  const contentRows: Row[] = isBlocked
    ? [{ type: "status", mode: "blocked" }]
    : locked
      ? [{ type: "status", mode: "private" }]
      : contentLoading
        ? [{ type: "status", mode: "loading" }]
        : tab === "posts"
          ? postRows.length ? postRows.map((post) => ({ type: "post" as const, id: post.id, post })) : [{ type: "status" as const, mode: "empty-posts" }]
          : (media.data ?? []).length ? (media.data ?? []).map((item) => ({ type: "media" as const, id: item.id, item })) : [{ type: "status" as const, mode: "empty-media" }];
  const showTabs = !locked && !isBlocked;
  const rows: Row[] = [{ type: "identity" }, ...(showTabs ? [{ type: "tabs" as const }] : []), ...contentRows];

  return <SafeAreaView edges={["top", "left", "right"]} style={[s.root, { backgroundColor: colors.background }]}>
    <Animated.FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(item) => item.type === "identity" ? "identity" : item.type === "tabs" ? "tabs" : item.type === "status" ? `status-${item.mode}` : `${item.type}-${item.id}`}
      renderItem={({ item }) => item.type === "identity"
        ? <Identity person={person} displayName={displayName} onAvatarPress={() => setAvatarOpen(true)} onLayout={(height) => { headerHeight.value = height; }} />
        : item.type === "tabs"
          ? <Tabs tabs={tabs} tab={tab} index={tabIndex} onChange={setTab} />
          : item.type === "post"
            ? <View style={s.postWrap}><PostCard post={item.post} /></View>
            : item.type === "media"
              ? <MediaCard item={item.item} />
              : item.mode === "blocked" ? <BlockedState name={displayName} />
                : item.mode === "private" ? <PrivateState /> : item.mode === "loading" ? <ActivityIndicator color={colors.accent} style={s.indicator} /> : <Empty label={item.mode === "empty-posts" ? "No posts yet." : "No media yet."} />}
      stickyHeaderIndices={showTabs ? [1] : undefined}
      contentContainerStyle={[s.list, { paddingTop: TOOLBAR_HEIGHT }]}
      ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onEndReached={() => { if (tab === "posts" && showTabs && posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage(); }}
      onEndReachedThreshold={.5}
      refreshing={tab === "posts" ? posts.isRefetching : media.isRefetching}
      onRefresh={() => { void profile.refetch(); if (showTabs) { if (tab === "posts") void posts.refetch(); else void media.refetch(); } }}
      ListFooterComponent={tab === "posts" && posts.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={s.indicator} /> : <View style={{ height: 18 }} />}
    />
    <ProfileToolbar
      person={person}
      own={own}
      following={!!state.data?.following}
      followLabel={label}
      followPending={state.isLoading || toggle.isPending}
      isBlocked={isBlocked}
      isMuted={isMuted}
      onFollow={doFollow}
      onUnfollow={startUnfollow}
      onMute={handleToggleMute}
      onMore={() => setShareOpen(true)}
      style={toolbarStyle}
    />
    {showTop ? (
      <Pressable
        accessibilityLabel="Scroll to top"
        onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
        style={[s.toTop, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
      >
        <Icon name="arrow-up" size={20} color={colors.text} />
      </Pressable>
    ) : null}
    <BottomNavigation />
    <MediaViewer
      visible={avatarOpen && !!person.avatar_url}
      items={person.avatar_url ? [{ uri: person.avatar_url, type: "image" }] : []}
      onClose={() => setAvatarOpen(false)}
      labelPrefix={`${displayName}'s profile photo`}
    />
    {!own ? (
      <ShareProfileSheet
        visible={shareOpen}
        person={person}
        displayName={displayName}
        url={`https://ako.app/profile/${person.username}`}
        isBlocked={isBlocked}
        isMuted={isMuted}
        isFollowedByUser={!!state.data?.followedBy}
        onToggleBlock={() => { setShareOpen(false); handleToggleBlock(); }}
        onToggleMute={handleToggleMute}
        onRemoveFollower={() => { setShareOpen(false); setRemoveFollowerConfirmOpen(true); }}
        onClose={() => setShareOpen(false)}
      />
    ) : null}
    <ConfirmDialog
      visible={unfollowConfirmOpen}
      title={`Unfollow ${displayName}?`}
      description={person.is_private ? "Their account is private — you'll need to request to follow again to see their posts." : "You'll stop seeing their posts in your feed."}
      confirmLabel="Unfollow"
      danger
      pending={toggle.isPending}
      onConfirm={confirmUnfollow}
      onCancel={() => setUnfollowConfirmOpen(false)}
    />
    <ConfirmDialog
      visible={removeFollowerConfirmOpen}
      title={`Remove ${displayName} as a follower?`}
      description="They won't be notified, but they'll stop seeing your posts in their feed."
      confirmLabel="Remove"
      danger
      pending={removeFollower.isPending}
      onConfirm={confirmRemoveFollower}
      onCancel={() => setRemoveFollowerConfirmOpen(false)}
    />
    <ConfirmDialog
      visible={blockConfirmOpen}
      title={`Block ${displayName}?`}
      description="They won't be able to follow you, message you, or see your posts. They won't be notified."
      confirmLabel="Block"
      danger
      pending={toggleBlock.isPending}
      onConfirm={confirmBlock}
      onCancel={() => setBlockConfirmOpen(false)}
    />
  </SafeAreaView>;
}

function ProfileToolbar({ person, own, following, followLabel, followPending, isBlocked, isMuted, onFollow, onUnfollow, onMute, onMore, style }: {
  person: Person; own: boolean; following: boolean; followLabel: string; followPending: boolean;
  isBlocked: boolean; isMuted: boolean; onFollow: () => void; onUnfollow: () => void; onMute: () => void; onMore: () => void; style: object;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const [relationshipOpen, setRelationshipOpen] = useState(false);
  // Probational users don't get the social layer — see
  // features/account/probational.ts. Hides Follow/Message entirely
  // rather than disabling them.
  const followLocked = useProbationalLock("probational_follow_enabled");
  const messageLocked = useProbationalLock("probational_message_enabled");

  return <>
    <Animated.View style={[s.toolbar, { backgroundColor: colors.background }, style]}>
      {own || following || messageLocked
        ? <View style={{ flex: 1 }} />
        : <Pressable disabled={isBlocked} onPress={() => router.push("/(tabs)/inbox")} style={[s.messageButton, { borderColor: colors.border, opacity: isBlocked ? .4 : 1 }]}><Icon name="message-square" size={16} color={colors.textSecondary} /><Text color="secondary" style={s.actionText}>Message</Text></Pressable>}
      {own
        ? <Pressable onPress={() => router.push("/profile/edit")} style={[s.messageButton, { borderColor: colors.border }]}><Text color="secondary" style={s.actionText}>Edit profile</Text></Pressable>
        : followLocked ? null : (
          <Pressable disabled={followPending || isBlocked} onPress={() => following ? setRelationshipOpen(true) : onFollow()} style={[s.followButton, { backgroundColor: following ? colors.accentSoft : colors.surfaceElevated, opacity: followPending || isBlocked ? .4 : 1 }]}>
            {followPending
              ? <ActivityIndicator size="small" color={colors.accent} />
              : <View style={s.followContent}>{following ? <Icon name="user-check" size={14} color={colors.accent} /> : null}<Text style={[s.actionText, { color: following ? colors.accent : colors.text }]}>{followLabel}</Text>{following ? <Icon name="chevron-down" size={14} color={colors.accent} /> : null}</View>}
          </Pressable>
        )}
      <Pressable accessibilityLabel="More options" onPress={onMore} style={s.more}><Icon name="more-horizontal" size={18} color={colors.textSecondary} /></Pressable>
    </Animated.View>
    <RelationshipMenu
      visible={relationshipOpen}
      person={person}
      isMuted={isMuted}
      onClose={() => setRelationshipOpen(false)}
      onMessage={() => { setRelationshipOpen(false); router.push("/(tabs)/inbox"); }}
      onMute={() => { setRelationshipOpen(false); onMute(); }}
      onUnfollow={() => { setRelationshipOpen(false); onUnfollow(); }}
    />
  </>;
}

function Identity({ person, displayName, onAvatarPress, onLayout }: { person: Person; displayName: string; onAvatarPress: () => void; onLayout: (height: number) => void }) {
  const domain = person.website_url?.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
  return <View onLayout={(event) => onLayout(event.nativeEvent.layout.height)}>
    <View style={s.identity}>
      {person.avatar_url
        ? <Pressable accessibilityRole="button" accessibilityLabel={`View ${displayName}'s profile photo`} onPress={onAvatarPress} style={s.avatarButton}><Avatar uri={person.avatar_url} name={displayName} size={64} /></Pressable>
        : <Avatar uri={person.avatar_url} name={displayName} size={64} />}
      <View style={s.identityCopy}>
        <View style={s.nameRow}>
          <Text style={s.name}>{displayName}</Text>
          <TierBadge tier={person.tier} />
        </View>
        {person.is_verified ? <View style={{ marginTop: 4 }}><VerifiedBadge size={15} label /></View> : null}
        {person.roles?.length ? <Text numberOfLines={2} color="secondary" style={s.roles}>{person.roles.map((role) => role.label).join(" · ")}</Text> : null}
        <View style={s.handleRow}><Text color="secondary" style={s.handle}>@{person.username}</Text>{domain ? <><Text color="secondary" style={s.handle}> / </Text><Pressable onPress={() => void Linking.openURL(/^https?:\/\//i.test(person.website_url!) ? person.website_url! : `https://${person.website_url}`)}><Text color="accent" style={s.handle}>◎ {domain}</Text></Pressable></> : null}</View>
      </View>
    </View>
    {person.bio ? <Text style={s.bio}>{person.bio}</Text> : null}
    <View style={s.stats}>
      <ConnectionLink username={person.username} list="following" count={person.following_count} label="Following" />
      <ConnectionLink username={person.username} list="followers" count={person.follower_count} label="Followers" />
    </View>
  </View>;
}

function ConnectionLink({ username, list, count, label }: { username: string; list: "following" | "followers"; count: number; label: string }) {
  const router = useRouter();
  return <Pressable onPress={() => router.push({ pathname: "/profiles/[username]/[list]", params: { username, list } })}><Text style={s.statNumber}>{count} <Text color="secondary" style={s.statLabel}>{label}</Text></Text></Pressable>;
}

function Tabs({ tabs, tab, index, onChange }: { tabs: Tab[]; tab: Tab; index: number; onChange: (tab: Tab) => void }) {
  const { colors } = useTheme();
  return <View style={[s.tabs, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
    <Pressable onPress={() => onChange("posts")} style={s.tab}><Text style={[s.tabText, { color: tab === "posts" ? colors.accent : colors.textMuted }]}>Posts</Text></Pressable>
    {tabs.includes("media") ? <Pressable onPress={() => onChange("media")} style={s.tab}><Text style={[s.tabText, { color: tab === "media" ? colors.accent : colors.textMuted }]}>Media</Text></Pressable> : null}
    <View style={[s.tabLine, { width: `${100 / tabs.length}%`, left: `${(index * 100) / tabs.length}%`, backgroundColor: colors.accent }]} />
  </View>;
}

function MediaCard({ item }: { item: ProfileMedia }) {
  const { colors } = useTheme();
  const details = Array.isArray(item.media_details) ? item.media_details[0] : item.media_details;
  const preview = details?.video_url || details?.audio_url;
  const effectivePrice = item.promo_price_usd ?? item.price_usd;
  const play = () => { if (preview) void Linking.openURL(preview); else Alert.alert(item.title, "A playable preview isn't available for this media yet."); };
  return <View style={[s.mediaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={s.mediaHero}>{item.thumbnail_url ? <Image source={{ uri: item.thumbnail_url }} style={s.mediaImage} contentFit="cover" /> : <View style={[s.mediaImage, s.mediaFallback, { backgroundColor: colors.accentSoft }]}><Icon name="image" size={38} color={colors.textMuted} /></View>}<Pressable accessibilityLabel={`Play ${item.title}`} onPress={play} style={({ pressed }) => [s.play, { backgroundColor: "rgba(235,229,219,.86)", opacity: pressed ? .72 : 1 }]}><Icon name="play" size={31} color="#11110F" style={{ marginLeft: 3 }} /></Pressable></View><View style={s.mediaCopy}><View style={s.mediaTitleRow}><Text numberOfLines={1} style={s.mediaTitle}>{item.title}</Text><View style={[s.pricePill, { backgroundColor: colors.accentSoft }]}><Text color="accent" style={s.priceText}>{effectivePrice <= 0 ? "Free" : `$${effectivePrice.toFixed(2)}`}</Text></View></View><Text color="secondary" style={s.mediaType}>Media</Text>{item.description ? <Text color="secondary" numberOfLines={2} style={s.mediaDescription}>{item.description}</Text> : null}</View></View>;
}

function RelationshipMenu({ visible, person, isMuted, onClose, onMessage, onMute, onUnfollow }: { visible: boolean; person: Person; isMuted: boolean; onClose: () => void; onMessage: () => void; onMute: () => void; onUnfollow: () => void }) {
  const { colors } = useTheme();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><Pressable onPress={onClose} style={s.overlay}><View style={[s.relationshipMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}><Pressable onPress={onMessage} style={s.relationRow}><Icon name="send" size={22} color={colors.text} /><Text style={s.relationText}>Message</Text></Pressable><Pressable onPress={onMute} style={s.relationRow}><Icon name={isMuted ? "bell" : "bell-off"} size={22} color={colors.text} /><Text style={s.relationText}>{isMuted ? "Unmute" : "Mute their updates"}</Text></Pressable><View style={[s.relationDivider, { backgroundColor: colors.border }]} /><Pressable onPress={onUnfollow} accessibilityLabel={`Unfollow ${person.display_name}`} style={s.relationRow}><Icon name="user-minus" size={22} color={colors.danger} /><Text style={[s.relationText, { color: colors.danger }]}>Unfollow</Text></Pressable></View></Pressable></Modal>;
}

// ---- "Send to" sheet ----
// Mirrors web's ShareProfileSheet: a "Send to" row of external share
// destinations plus a grid of account-management actions. Every action
// below is wired to a real mutation — previously every tool in this
// grid (Customise name, Report, Block, QR) all just re-opened the OS
// share sheet, which meant tapping "Block" silently did nothing of the
// kind. Nickname and report both open their own step within this same
// sheet, matching web's mode="nickname"/mode="report" pattern, rather
// than the standalone modals web also has for the ReportModal (post/
// project) case — that one is folded into the "report-content" step
// below using the same posts already available via useIdentityPosts.
function ShareProfileSheet({ visible, person, displayName, url, isBlocked, isMuted, isFollowedByUser, onToggleBlock, onToggleMute, onRemoveFollower, onClose }: {
  visible: boolean; person: Person; displayName: string; url: string;
  isBlocked: boolean; isMuted: boolean; isFollowedByUser: boolean;
  onToggleBlock: () => void; onToggleMute: () => void; onRemoveFollower: () => void; onClose: () => void;
}) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<"menu" | "nickname" | "report" | "report-content" | "report-reason">("menu");
  const share = () => void Share.share({ message: url, url });

  function closeAndReset() {
    onClose();
    // Reset after the close animation finishes so the sheet doesn't
    // visibly flash back to "menu" while it's still sliding away.
    setTimeout(() => setMode("menu"), 250);
  }

  // ---- Nickname step ----
  const { data: nickname } = useContactNickname(person.id);
  const setNickname = useSetContactNickname(person.id);
  const [nicknameInput, setNicknameInput] = useState(nickname ?? "");

  async function saveNickname() {
    try {
      await setNickname.mutateAsync(nicknameInput);
      setMode("menu");
    } catch {
      Alert.alert("Couldn't save that name — try again.");
    }
  }

  // ---- Report-profile step ----
  const { data: reasons } = useReportReasons();
  const submitReport = useSubmitReport();
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);

  async function submitProfileReport() {
    if (!reasonId) return;
    try {
      await submitReport.mutateAsync({ targetType: "profile", targetId: person.id, reasonId, details });
      setReportSubmitted(true);
    } catch {
      Alert.alert("Couldn't submit the report — try again.");
    }
  }

  // ---- Report-content step (a specific post) ----
  const posts = useIdentityPosts(mode === "report-content" || mode === "report-reason" ? person.id : "", "profile");
  const [targetPost, setTargetPost] = useState<Post | null>(null);

  async function submitContentReport() {
    if (!reasonId || !targetPost) return;
    try {
      await submitReport.mutateAsync({ targetType: "post", targetId: targetPost.id, reasonId, details });
      setReportSubmitted(true);
    } catch {
      Alert.alert("Couldn't submit the report — try again.");
    }
  }

  if (mode === "nickname") {
    return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setMode("menu")}>
      <View style={s.shareOverlay}>
        <Pressable onPress={() => setMode("menu")} style={StyleSheet.absoluteFill} />
        <View style={[s.stepSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={s.stepTitle}>Customise name</Text>
          <Text color="secondary" style={s.stepSubtitle}>Only you will see this name for {person.display_name}.</Text>
          <TextInput
            autoFocus
            value={nicknameInput}
            onChangeText={setNicknameInput}
            placeholder={person.display_name}
            placeholderTextColor={colors.textMuted}
            maxLength={60}
            style={[s.nicknameInput, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
          />
          <View style={s.stepButtonRow}>
            <Pressable onPress={() => setMode("menu")} style={[s.stepCancel, { borderColor: colors.border }]}><Text color="secondary" style={s.stepButtonText}>Cancel</Text></Pressable>
            <Pressable disabled={setNickname.isPending} onPress={() => void saveNickname()} style={[s.stepConfirm, { backgroundColor: colors.accent, opacity: setNickname.isPending ? .6 : 1 }]}><Text style={[s.stepButtonText, { color: colors.onAccent, fontWeight: "700" }]}>{setNickname.isPending ? "Saving…" : "Save"}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>;
  }

  if (mode === "report" || mode === "report-content" || mode === "report-reason") {
    const reportingPost = mode === "report-reason" && targetPost;
    const submit = reportingPost ? submitContentReport : submitProfileReport;
    const pending = submitReport.isPending;

    return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setMode("menu")}>
      <View style={s.shareOverlay}>
        <Pressable onPress={() => setMode("menu")} style={StyleSheet.absoluteFill} />
        <ScrollView style={[s.stepSheet, s.reportSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {reportSubmitted ? (
            <View style={s.reportDone}>
              <Icon name="flag" size={28} color={colors.accent} />
              <Text style={s.stepTitle}>Report submitted</Text>
              <Text color="secondary" align="center" style={s.stepSubtitle}>Thanks for letting us know. Our team will review this.</Text>
              <Pressable onPress={closeAndReset} style={[s.stepConfirm, { backgroundColor: colors.accent, alignSelf: "stretch" }]}><Text style={[s.stepButtonText, { color: colors.onAccent, fontWeight: "700" }]}>Done</Text></Pressable>
            </View>
          ) : mode === "report" ? (
            <>
              <Text style={s.stepTitle}>Report {person.display_name}</Text>
              <Text color="secondary" style={s.stepSubtitle}>What&apos;s wrong with this account?</Text>
              {(reasons ?? []).map((reason: ReportReason) => (
                <Pressable key={reason.id} onPress={() => setReasonId(reason.id)} style={[s.reasonRow, { borderColor: reasonId === reason.id ? colors.accent : colors.border, backgroundColor: reasonId === reason.id ? colors.accentSoft : "transparent" }]}>
                  <Text style={reasonId === reason.id ? { color: colors.accent } : undefined}>{reason.label}</Text>
                </Pressable>
              ))}
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Add details (optional)"
                placeholderTextColor={colors.textMuted}
                multiline
                style={[s.detailsInput, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
              />
              <View style={s.stepButtonRow}>
                <Pressable onPress={() => setMode("menu")} style={[s.stepCancel, { borderColor: colors.border }]}><Text color="secondary" style={s.stepButtonText}>Cancel</Text></Pressable>
                <Pressable disabled={!reasonId || pending} onPress={() => void submit()} style={[s.stepConfirm, { backgroundColor: colors.danger, opacity: !reasonId || pending ? .5 : 1 }]}><Text style={[s.stepButtonText, { color: colors.onAccent, fontWeight: "700" }]}>{pending ? "Submitting…" : "Submit"}</Text></Pressable>
              </View>
            </>
          ) : mode === "report-content" ? (
            <>
              <Text style={s.stepTitle}>What are you reporting?</Text>
              {posts.isLoading ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} /> : null}
              {!posts.isLoading && (posts.data?.pages.flat() ?? []).length === 0 ? <Text color="muted" style={{ paddingVertical: 20 }}>No posts to report.</Text> : null}
              {(posts.data?.pages.flat() ?? []).map((post: Post) => (
                <Pressable key={post.id} onPress={() => { setTargetPost(post); setMode("report-reason"); }} style={[s.reasonRow, { borderColor: colors.border }]}>
                  <Text numberOfLines={2}>{post.heading?.trim() || post.content.slice(0, 80) || "Untitled post"}</Text>
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <View style={s.stepHeaderRow}>
                <Pressable onPress={() => setMode("report-content")} style={s.backButton}><Icon name="arrow-left" size={18} color={colors.textSecondary} /></Pressable>
                <Text style={s.stepTitle}>Report this post</Text>
              </View>
              {(reasons ?? []).map((reason: ReportReason) => (
                <Pressable key={reason.id} onPress={() => setReasonId(reason.id)} style={[s.reasonRow, { borderColor: reasonId === reason.id ? colors.accent : colors.border, backgroundColor: reasonId === reason.id ? colors.accentSoft : "transparent" }]}>
                  <Text style={reasonId === reason.id ? { color: colors.accent } : undefined}>{reason.label}</Text>
                </Pressable>
              ))}
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Add details (optional)"
                placeholderTextColor={colors.textMuted}
                multiline
                style={[s.detailsInput, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
              />
              <View style={s.stepButtonRow}>
                <Pressable onPress={() => setMode("menu")} style={[s.stepCancel, { borderColor: colors.border }]}><Text color="secondary" style={s.stepButtonText}>Cancel</Text></Pressable>
                <Pressable disabled={!reasonId || pending} onPress={() => void submit()} style={[s.stepConfirm, { backgroundColor: colors.danger, opacity: !reasonId || pending ? .5 : 1 }]}><Text style={[s.stepButtonText, { color: colors.onAccent, fontWeight: "700" }]}>{pending ? "Submitting…" : "Submit"}</Text></Pressable>
              </View>
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>;
  }

  const disc = (background: string, name: IconName, color: string) => <View style={[s.actionCircle, { backgroundColor: background }]}><Icon name={name} size={20} color={color} /></View>;
  const actions = [
    { label: "WhatsApp", glyph: <WhatsAppGlyph size={52} />, onPress: share },
    { label: "Copy link", glyph: disc(`${colors.text}1A`, "link-2", colors.text), onPress: share },
    { label: "SMS", glyph: disc("#2FCC66", "message-square", "#FFFFFF"), onPress: share },
    { label: "Email", glyph: disc(`${colors.text}B3`, "mail", colors.background), onPress: share },
    { label: "Facebook", glyph: <FacebookGlyph size={52} />, onPress: share },
    { label: "X", glyph: <XGlyph size={52} />, onPress: share },
    { label: "More", glyph: disc(`${colors.text}1A`, "share-2", colors.text), onPress: share },
  ];
  const tools: { key: string; label: string; icon: IconName; danger?: boolean; onPress: () => void }[] = [
    { key: "nickname", label: "Customise\nname", icon: "pen-square", onPress: () => setMode("nickname") },
    { key: "report", label: "Report", icon: "flag", onPress: () => { setReasonId(null); setDetails(""); setReportSubmitted(false); setMode("report"); } },
    { key: "report-content", label: "Report a\npost", icon: "file-warning", onPress: () => { setReasonId(null); setDetails(""); setReportSubmitted(false); setTargetPost(null); setMode("report-content"); } },
    { key: "mute", label: isMuted ? "Unmute" : "Mute their\nupdates", icon: isMuted ? "bell" : "bell-off", onPress: onToggleMute },
    { key: "block", label: isBlocked ? "Unblock" : "Block", icon: "ban", danger: !isBlocked, onPress: onToggleBlock },
    ...(isFollowedByUser ? [{ key: "remove-follower", label: "Remove this\nfollower", icon: "user-minus" as IconName, danger: true, onPress: onRemoveFollower }] : []),
    { key: "qr", label: "QR code", icon: "qr-code", onPress: share },
  ];

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={s.shareOverlay}><Pressable onPress={onClose} style={StyleSheet.absoluteFill} /><View style={[s.shareSheet, { backgroundColor: colors.background, borderColor: colors.border }]}><View style={s.sheetTitleRow}><View style={{ width: 24 }} /><Text style={s.sheetTitle}>Send to</Text><Pressable onPress={onClose} style={s.sheetClose}><Icon name="x" size={22} color={colors.textSecondary} /></Pressable></View><View style={[s.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}><Icon name="search" size={16} color={colors.textMuted} /><TextInput placeholder="Search" placeholderTextColor={colors.textMuted} style={[s.searchInput, { color: colors.text }]} /></View><View style={s.recipientRow}><Avatar uri={person.avatar_url} name={displayName} size={54} /><Text numberOfLines={1} style={s.recipientName}>{displayName}</Text></View><View style={[s.sheetDivider, { backgroundColor: colors.border }]} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.actionRow}>{actions.map(action => <Pressable key={action.label} onPress={action.onPress} style={s.shareAction}>{action.glyph}<Text color="secondary" align="center" style={s.actionLabel}>{action.label}</Text></Pressable>)}</ScrollView><View style={[s.sheetDivider, { backgroundColor: colors.border }]} /><View style={s.toolGrid}>{tools.map(tool => <Pressable key={tool.key} onPress={tool.onPress} style={s.toolItem}><View style={[s.toolCircle, { backgroundColor: colors.surfaceElevated }]}><Icon name={tool.icon} size={20} color={tool.danger ? colors.danger : colors.text} /></View><Text align="center" style={[s.toolLabel, { color: tool.danger ? colors.danger : colors.text }]}>{tool.label}</Text></Pressable>)}</View></View></View></Modal>;
}

function PrivateState() {
  const { colors } = useTheme();
  return <View style={s.private}><View style={[s.lock, { backgroundColor: colors.accentSoft }]}><Icon name="lock" size={25} color={colors.accent} /></View><Text variant="heading">This account is private</Text><Text color="secondary" align="center">Follow this account to see their posts and media.</Text></View>;
}

function BlockedState({ name }: { name: string }) {
  const { colors } = useTheme();
  return <View style={s.private}><View style={[s.lock, { backgroundColor: colors.accentSoft }]}><Icon name="ban" size={25} color={colors.accent} /></View><Text variant="heading">You&apos;ve blocked {name}</Text><Text color="secondary" align="center">Unblock from the ⋯ menu to see their posts and media again.</Text></View>;
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
    { label: "Discover", onPress: () => router.push("/(tabs)/discover"), icon: <Icon name="search" size={24} color={colors.textMuted} strokeWidth={1.75} /> },
    { label: "Library", onPress: () => router.push("/(tabs)/create"), icon: <LibraryIcon color={colors.textMuted} /> },
    { label: "Messages", onPress: () => router.push("/(tabs)/inbox"), icon: <Icon name="message-circle" size={24} color={colors.textMuted} strokeWidth={1.75} /> },
    { label: "Profile", onPress: () => router.push("/(tabs)/profile"), icon: <Icon name="user" size={24} color={colors.textMuted} strokeWidth={1.75} /> },
  ];
  return <View style={[s.bottomNav, { backgroundColor: colors.surface, borderTopColor: colors.border, height: 76 + bottomInset, paddingBottom: bottomInset }]}>{items.map((item) => <Pressable key={item.label} onPress={item.onPress} style={s.navItem}>{item.icon}<Text color="muted" style={s.navLabel}>{item.label}</Text></Pressable>)}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  loading: { padding: 18, gap: 16 },
  list: { paddingBottom: 88 },
  postWrap: { paddingHorizontal: 18 },
  toolbar: { position: "absolute", left: 0, right: 0, top: 0, zIndex: 5, height: TOOLBAR_HEIGHT, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  messageButton: { height: 42, minWidth: 126, borderRadius: 21, borderWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  followButton: { minWidth: 91, height: 42, paddingHorizontal: 19, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  followContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  actionText: { fontSize: 16, lineHeight: 20, fontWeight: "700" },
  more: { width: 30, height: 42, alignItems: "center", justifyContent: "center" },
  identity: { paddingHorizontal: 18, paddingTop: 16, flexDirection: "row", alignItems: "flex-start", gap: 18 },
  avatarButton: { width: 64, height: 64, borderRadius: 32 },
  identityCopy: { flex: 1, paddingTop: 7 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { flexShrink: 1, fontSize: 20, lineHeight: 25, fontWeight: "700" },
  roles: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  handleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 1 },
  handle: { fontSize: 16, lineHeight: 21 },
  bio: { paddingHorizontal: 18, marginTop: 16, fontSize: 15, lineHeight: 21 },
  stats: { paddingHorizontal: 18, marginTop: 20, marginBottom: 20, flexDirection: "row", gap: 22 },
  statNumber: { fontSize: 16, lineHeight: 21, fontWeight: "800" },
  statLabel: { fontSize: 16, lineHeight: 21, fontWeight: "400" },
  tabs: { height: 51, flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, position: "relative" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", position: "relative" },
  tabText: { fontSize: 16, lineHeight: 20, fontWeight: "700" },
  tabLine: { position: "absolute", height: 2, bottom: -1, borderRadius: 2 },
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
  stepSheet: { minHeight: 220, maxHeight: "88%", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  reportSheet: { paddingBottom: 8 },
  stepTitle: { fontSize: 17, lineHeight: 22, fontWeight: "700" },
  stepSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 16 },
  stepHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  backButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center", marginLeft: -6 },
  nicknameInput: { height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  detailsInput: { minHeight: 72, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, marginTop: 4, marginBottom: 4, textAlignVertical: "top" },
  stepButtonRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  stepCancel: { flex: 1, height: 46, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  stepConfirm: { flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stepButtonText: { fontSize: 15, fontWeight: "600" },
  reasonRow: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, marginTop: 8, justifyContent: "center" },
  reportDone: { alignItems: "center", gap: 10, paddingVertical: 24 },
  toTop: { position: "absolute", right: 18, bottom: 108, width: 42, height: 42, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", elevation: 4, zIndex: 6 },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, height: 76, borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", flexDirection: "row", paddingTop: 13 },
  navItem: { flex: 1, alignItems: "center", gap: 5 },
  navLabel: { fontSize: 11, lineHeight: 14, fontWeight: "500" },
});

// Stand-in for a profile that isn't cached and can't be fetched offline. The name and avatar are
// whatever profiles_cache last saw for this username (a chat, or an earlier visit); the rest
// (counts, bio, posts) genuinely needs the network, so this says so instead of guessing.
function OfflineProfile({ cached, onRetry }: { cached: { username: string; display_name: string; avatar_url: string | null } | null; onRetry: () => void }) {
  const router = useRouter(); const { colors } = useTheme();
  return <SafeAreaView style={[s.root, { backgroundColor: colors.background, paddingHorizontal: 16 }]}>
    <View style={{ alignItems: "flex-start" }}><Button label="Back" variant="ghost" onPress={() => router.back()} /></View>
    {cached ? <View style={{ alignItems: "center", gap: 6, paddingTop: 20 }}><Avatar uri={cached.avatar_url} name={cached.display_name} size={88} /><Text variant="title">{cached.display_name}</Text><Text color="muted">@{cached.username}</Text></View> : null}
    <OfflineState message="This profile isn’t saved on your device yet. It will load when you’re back online." onRetry={onRetry} />
  </SafeAreaView>;
}

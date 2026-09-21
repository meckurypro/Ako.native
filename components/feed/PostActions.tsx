// File: components/feed/PostActions.tsx
import { Alert, InteractionManager, Modal, Pressable, Share, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Icon as GlyphIcon, type IconName } from "@/components/core/Icon";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, useReducedMotion } from "react-native-reanimated";
import { PressableScale, Text } from "@/components/core";
import {
  useBookmark,
  useDeletePost,
  useEngagementOrder,
  usePost,
  usePrioritizePost,
  useReaction,
  useSetPostArchived,
  useToggleBookmark,
  useToggleReaction,
  type SecondaryActionKey,
} from "@/features/feed/api";
import { useActiveIdentity } from "@/features/compose/api";
import { useHasReshared, usePrioritizedPostToday, useRecordShare } from "@/features/feed/postExtras";
import type { Stance } from "@/features/feed/types";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { StanceComposer } from "./StanceComposer";
import { GiftPicker } from "./GiftPicker";
import { LikeHeart } from "./LikeHeart";

type Icon = IconName;
type ActionItem = { key: string; icon: Icon; label: string; active?: boolean; count?: string; danger?: boolean; onPress: () => void };

function MainAction({ icon, label, active, onPress, onLongPress }: { icon: Icon; label?: string; active?: boolean; onPress: () => void; onLongPress?: () => void }) {
  const { colors } = useTheme();
  return <PressableScale accessibilityRole="button" accessibilityLabel={label ?? icon} onPress={onPress} onLongPress={onLongPress} delayLongPress={450} hitSlop={8} style={s.mainAction}>{icon === "heart" ? <LikeHeart active={!!active} color="#D98978" /> : <GlyphIcon name={icon} size={24} color={active ? "#D98978" : colors.text} fill={active ? "#D98978" : "none"} />}{label ? <Text style={[s.mainCount, { color: active ? "#D98978" : colors.text }]}>{label}</Text> : null}</PressableScale>;
}

function SheetAction({ item }: { item: ActionItem }) {
  const { colors } = useTheme();
  const color = item.danger ? colors.danger : item.active ? colors.accent : colors.text;
  return <PressableScale accessibilityRole="button" accessibilityLabel={item.label} onPress={item.onPress} style={s.sheetAction}><GlyphIcon name={item.icon} size={25} color={color} fill={item.active ? color : "none"} /><Text color={item.danger ? "danger" : item.active ? "accent" : "secondary"} style={s.sheetLabel}>{item.label}{item.count ? ` (${item.count})` : ""}</Text></PressableScale>;
}

function ActionSheet({ children, colors, onClose }: { children: React.ReactNode; colors: ReturnType<typeof useTheme>["colors"]; onClose: () => void }) {
  const reduced = useReducedMotion();
  return <Modal visible transparent animationType="none" onRequestClose={onClose}><View style={s.modal}><Animated.View entering={reduced ? undefined : FadeIn.duration(140)} exiting={reduced ? undefined : FadeOut.duration(110)} style={[s.backdrop, { backgroundColor: colors.overlay }]}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} /></Animated.View><Animated.View entering={reduced ? undefined : SlideInDown.duration(220)} exiting={reduced ? undefined : SlideOutDown.duration(180)} style={[s.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</Animated.View></View></Modal>;
}

export function PostActions({ postId, recipientId, recipientName, recipientAvatar, likes, dislikes: _dislikes, comments, shares, support, disagree, pushback, onComments, onReshare, hasTaggedProject, disabled, reshareTargetId }: { postId: string; recipientId?: string; recipientName?: string; recipientAvatar?: string | null; likes: number; dislikes: number; comments: number; shares: number; support: number; disagree: number; pushback: number; onComments: () => void; onReshare: () => void; hasTaggedProject?: boolean; disabled?: boolean; reshareTargetId?: string }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [more, setMore] = useState(false);
  const [stance, setStance] = useState<Stance | null>(null);
  const [gift, setGift] = useState(false);
  const post = usePost(postId);
  const giftRecipientId = recipientId ?? post.data?.author.id;
  const giftRecipientName = recipientName ?? post.data?.author.display_name;
  const giftRecipientAvatar = recipientAvatar ?? post.data?.author.avatar_url ?? null;
  const isOwner = !!user?.id && !!giftRecipientId && user.id === giftRecipientId;
  const isArchived = !!post.data?.is_archived;
  // Gifting is hidden while acting as a page (wallets belong to people, not pages) and on posts that tag a project for sale. Callers that already hold the post pass hasTaggedProject so the button never flashes in before the post query resolves.
  const identity = useActiveIdentity();
  const viewingAsPage = identity.data?.mode === "page";
  const taggedProject = hasTaggedProject ?? !!post.data?.tagged_project;

  const like = useReaction(postId, "like");
  const dislike = useReaction(postId, "dislike");
  const bookmark = useBookmark(postId);
  const toggleLike = useToggleReaction(postId, "like");
  const toggleDislike = useToggleReaction(postId, "dislike");
  const toggleBookmark = useToggleBookmark(postId);
  const prioritizePost = usePrioritizePost();
  const archivePost = useSetPostArchived();
  const deletePost = useDeletePost();
  const engagement = useEngagementOrder();
  const client = useQueryClient();
  // You can only reshare a given post once: hide Reshare after that (never fetched for your own posts, where it's hidden anyway).
  const hasReshared = useHasReshared(reshareTargetId ?? postId, !isOwner);
  const prioritizedToday = usePrioritizedPostToday(giftRecipientId, isOwner);
  const isPrioritizedToday = prioritizedToday.data === postId;

  const recordShare = useRecordShare(postId);
  // Recorded only if the person actually completed the share, like web — it doubles as the usage signal Share is ranked by.
  const share = async () => { try { const result = await Share.share({ message: `https://ako.app/post/${postId}` }); if (result.action === Share.sharedAction) recordShare.mutate(); } catch { /* share sheet failed to open */ } };
  const react = async (kind: "like" | "dislike") => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (kind === "like") { if (dislike.data) await toggleDislike.mutateAsync(true); await toggleLike.mutateAsync(!!like.data); }
      else { if (like.data) await toggleLike.mutateAsync(true); await toggleDislike.mutateAsync(!!dislike.data); }
    } catch { Alert.alert("Couldn't update reaction", "Check your connection and try again."); }
  };
  const saved = () => { void Haptics.selectionAsync(); void toggleBookmark.mutateAsync(!!bookmark.data).catch(() => Alert.alert("Couldn't update saved posts")); };
  const chooseStance = (value: Stance) => setStance(value);
  const chooseGift = () => setGift(true);
  const chooseReshare = () => onReshare();
  const closeAnd = (fn: () => void) => {
    setMore(false);
    InteractionManager.runAfterInteractions(() => setTimeout(fn, 80));
  };
  const comingSoon = (label: string) => Alert.alert(label, `${label} is not available on mobile yet.`);

  const confirmPrioritize = () => Alert.alert("Prioritize this post?", "This becomes your priority post for today.", [{ text: "Cancel", style: "cancel" }, { text: "Prioritize", onPress: () => prioritizePost.mutate(postId, { onSuccess: () => void client.invalidateQueries({ queryKey: ["prioritized-post-today"] }), onError: err => Alert.alert("Couldn't prioritize", err instanceof Error ? err.message : "Please try again.") }) }]);
  const confirmArchive = () => isArchived ? archivePost.mutate({ postId, archived: false }, { onError: () => Alert.alert("Couldn't unarchive this post") }) : Alert.alert("Archive this post?", "It will be hidden from your profile and the feed until you unarchive it from your Archive.", [{ text: "Cancel", style: "cancel" }, { text: "Archive", onPress: () => archivePost.mutate({ postId, archived: true }, { onError: () => Alert.alert("Couldn't archive this post") }) }]);
  const confirmDelete = () => Alert.alert("Delete this post?", "This action cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deletePost.mutate(postId, { onError: () => Alert.alert("Couldn't delete this post") }) }]);

  const action = (key: SecondaryActionKey): ActionItem => key === "support" ? { key, icon: "handshake", label: "Support", count: support ? String(support) : undefined, onPress: () => chooseStance("support") } : key === "reshare" ? { key, icon: "repeat-2", label: "Reshare", count: shares ? String(shares) : undefined, onPress: chooseReshare } : key === "share" ? { key, icon: "redo-2", label: "Share", onPress: share } : key === "gift" ? { key, icon: "gift", label: "Gift", onPress: chooseGift } : key === "save" ? { key, icon: "bookmark", label: bookmark.data ? "Saved" : "Save", active: !!bookmark.data, onPress: saved } : key === "disagree" ? { key, icon: "frown", label: "Disagree", count: disagree ? String(disagree) : undefined, onPress: () => chooseStance("disagree") } : key === "pushback" ? { key, icon: "hand", label: "Pushback", count: pushback ? String(pushback) : undefined, onPress: () => chooseStance("pushback") } : { key, icon: "thumbs-down", label: dislike.data ? "Disliked" : "Dislike", active: !!dislike.data, count: _dislikes ? String(_dislikes) : undefined, onPress: () => void react("dislike") };

  const defaultOrder: SecondaryActionKey[] = ["support", "reshare", "share", "gift", "save", "disagree", "pushback", "dislike"];
  const hiddenForOwner: SecondaryActionKey[] = ["reshare", "gift", "disagree", "pushback", "dislike"];
  const order = (engagement.data ?? defaultOrder).filter(key => (!isOwner || !hiddenForOwner.includes(key)) && !(key === "gift" && (viewingAsPage || taggedProject)) && !(key === "reshare" && hasReshared.data));
  const ownerActions: ActionItem[] = isOwner ? [
    { key: "prioritize", icon: "rocket", label: isPrioritizedToday ? "Prioritized today" : "Prioritize", active: isPrioritizedToday, onPress: () => closeAnd(isPrioritizedToday ? () => {} : confirmPrioritize) },
    { key: "promote", icon: "megaphone", label: "Promote", onPress: () => closeAnd(() => comingSoon("Promote")) },
    { key: "tag-people", icon: "tag", label: "Tag people", onPress: () => closeAnd(() => comingSoon("Tag people")) },
    { key: "collaborators", icon: "users", label: "Collaborators", onPress: () => closeAnd(() => comingSoon("Collaborators")) },
    { key: "archive", icon: isArchived ? "rotate-ccw" : "archive", label: isArchived ? "Unarchive" : "Archive", onPress: () => closeAnd(confirmArchive) },
    { key: "delete", icon: "trash-2", label: "Delete", danger: true, onPress: () => closeAnd(confirmDelete) },
  ] : [];
  const moreActions = [...order.map(action), ...ownerActions];
  const middle = moreActions.slice(0, 3);

  return <>
    <View style={s.actionBlock}><View pointerEvents={disabled ? "none" : "auto"} style={[s.row, disabled && { opacity: 0.4 }]}><MainAction icon="heart" label={likes ? String(likes) : undefined} active={!!like.data} onPress={() => void react("like")} onLongPress={() => setMore(true)}/>{middle.map(item => <MainAction key={item.key} icon={item.icon} label={item.count} active={item.active} onPress={item.onPress} onLongPress={() => setMore(true)}/>)}<MainAction icon="more-horizontal" onPress={() => setMore(true)}/></View><Pressable onPress={onComments} hitSlop={7} style={s.comments}><Text color="secondary" style={s.commentsText}>Comments: {comments}</Text></Pressable></View>
    {more && <ActionSheet colors={colors} onClose={() => setMore(false)}><View style={s.grid}>{moreActions.map(item => <SheetAction key={item.key} item={{ ...item, onPress: () => closeAnd(item.onPress) }} />)}</View><Pressable onPress={() => setMore(false)} style={[s.cancel, { borderTopColor: colors.border }]}><Text color="secondary" style={s.cancelText}>Cancel</Text></Pressable></ActionSheet>}
    {stance && <StanceComposer postId={postId} initial={stance} onClose={() => setStance(null)}/>}
    {Boolean(gift && giftRecipientId && giftRecipientName) && <GiftPicker recipientId={giftRecipientId!} recipientName={giftRecipientName!} recipientAvatar={giftRecipientAvatar} postId={postId} onClose={() => setGift(false)}/>}
  </>;
}

const s = StyleSheet.create({ actionBlock: { marginTop: 4 }, row: { height: 38, flexDirection: "row", alignItems: "center" }, mainAction: { width: "20%", height: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }, mainCount: { fontSize: 13, fontWeight: "700" }, comments: { width: "20%", paddingTop: 8, paddingBottom: 1 }, commentsText: { fontSize: 11, lineHeight: 15 }, modal: { flex: 1, justifyContent: "flex-end" }, backdrop: { ...StyleSheet.absoluteFill }, sheet: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }, grid: { paddingHorizontal: 22, paddingTop: 19, paddingBottom: 14, flexDirection: "row", flexWrap: "wrap" }, sheetAction: { width: "25%", minHeight: 71, alignItems: "center", justifyContent: "center", gap: 5 }, sheetLabel: { fontSize: 11, lineHeight: 15, textAlign: "center" }, cancel: { minHeight: 51, alignItems: "center", justifyContent: "center", borderTopWidth: StyleSheet.hairlineWidth }, cancelText: { fontSize: 14, fontWeight: "600" } });

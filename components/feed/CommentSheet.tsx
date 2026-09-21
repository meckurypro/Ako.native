import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Avatar, Text } from "@/components/core";
import { useCommentReaction, useComments, useReplies, useToggleCommentReaction } from "@/features/feed/api";
import type { Comment, Stance } from "@/features/feed/types";
import { useTheme } from "@/providers/ThemeProvider";
import { StanceComposer } from "./StanceComposer";

const stanceColor = (stance: Comment["stance"]) => stance === "disagree" ? "#D98978" : stance === "pushback" ? "#B8862E" : "#58B981";
const age = (date: string) => { const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000)); return minutes < 1 ? "now" : minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`; };
const label = (stance: Stance) => stance[0].toUpperCase() + stance.slice(1);

export function CommentSheet({ postId, count, onClose }: { postId: string; count: number; onClose: () => void }) {
  const { colors } = useTheme();
  const comments = useComments(postId);
  const [composer, setComposer] = useState<{ stance: Stance; parentId?: string } | null>(null);
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.root}>
      <Pressable style={[s.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={[s.handle, { backgroundColor: colors.border }]} />
        <View style={[s.head, { borderBottomColor: colors.border }]}>
          <Text style={s.title}>Comments <Text color="secondary" style={s.titleCount}>{count}</Text></Text>
          <Pressable accessibilityLabel="Close comments" onPress={onClose} style={s.close}><MaterialCommunityIcons name="close" size={22} color={colors.textMuted} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
          {comments.isLoading ? <ActivityIndicator color={colors.accent} style={s.loading} /> : comments.isError ? <Text color="danger" align="center" style={s.empty}>Couldn’t load comments.</Text> : comments.data?.length ? comments.data.map(comment => <CommentThread key={comment.id} postId={postId} comment={comment} onCompose={(stance, parentId) => setComposer({ stance, parentId })} />) : <Text color="muted" align="center" style={s.empty}>No comments yet. Start the reasoning.</Text>}
        </ScrollView>
        <View style={[s.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Pressable onPress={() => setComposer({ stance: "support" })} style={[s.commentButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}><Text color="muted" style={s.commentButtonText}>Add a comment...</Text></Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
    {composer && <StanceComposer postId={postId} initial={composer.stance} parentCommentId={composer.parentId} onClose={() => setComposer(null)} />}
  </Modal>;
}

function CommentThread({ postId, comment, depth, onCompose }: { postId: string; comment: Comment; depth?: number; onCompose: (stance: Stance, parentId: string) => void }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const replies = useReplies(postId, comment.id, expanded);
  const liked = useCommentReaction(comment.id, "like");
  const disliked = useCommentReaction(comment.id, "dislike");
  const toggleLike = useToggleCommentReaction(postId, comment.id, "like");
  const toggleDislike = useToggleCommentReaction(postId, comment.id, "dislike");
  const hasReplies = comment.reply_count > 0 || (replies.data?.length ?? 0) > 0;
  const left = depth ? 20 : 0;
  const share = async () => { setMenu(false); try { await Share.share({ message: comment.content }); } catch { /* share dismissed */ } };
  return <View style={[s.thread, depth ? [s.replyThread, { marginLeft: left, borderLeftColor: colors.border }] : null]}>
    <View style={s.comment}>
      <View style={s.commentHead}>
        <Avatar uri={comment.author.avatar_url} name={comment.author.display_name} size={depth ? 31 : 33} />
        <View style={s.commentName}><View style={s.nameLine}>
          <Text numberOfLines={1} style={s.name}>{comment.author.display_name}</Text>
          {comment.stance && <View style={[s.stance, { backgroundColor: `${stanceColor(comment.stance)}26` }]}><Text style={[s.stanceText, { color: stanceColor(comment.stance) }]}>{label(comment.stance)}</Text></View>}
          <Text color="muted" style={s.time}>{age(comment.created_at)}</Text>
        </View></View>
        <Pressable accessibilityLabel="Comment options" onPress={() => setMenu(value => !value)} style={s.more}><MaterialCommunityIcons name="dots-horizontal" size={19} color={colors.textMuted} /></Pressable>
      </View>
      <Text style={[s.commentText, depth ? s.replyText : null]}>{comment.content}</Text>
      <View style={[s.commentActions, depth ? s.replyActions : null]}>
        <Pressable disabled={toggleLike.isPending} onPress={() => void toggleLike.mutateAsync(!!liked.data)} style={s.iconAction}><MaterialCommunityIcons name={liked.data ? "heart" : "heart-outline"} size={19} color="#D98978" />{comment.like_count > 0 && <Text style={[s.reactionCount, liked.data && { color: "#D98978" }]}>{comment.like_count}</Text>}</Pressable>
        <Pressable disabled={toggleDislike.isPending} onPress={() => void toggleDislike.mutateAsync(!!disliked.data)} style={s.iconAction}><MaterialCommunityIcons name={disliked.data ? "thumb-down" : "thumb-down-outline"} size={18} color={disliked.data ? "#D98978" : colors.textMuted} />{comment.dislike_count > 0 && <Text style={[s.reactionCount, disliked.data && { color: "#D98978" }]}>{comment.dislike_count}</Text>}</Pressable>
        {(["support", "disagree", "pushback"] as Stance[]).map(stance => <Pressable key={stance} onPress={() => onCompose(stance, comment.id)}><Text style={s.commentAction}>{label(stance)}</Text></Pressable>)}
      </View>
      {menu && <View style={[s.commentMenu, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}><Pressable onPress={() => void share()} style={s.menuOption}><MaterialCommunityIcons name="share-variant-outline" size={18} color={colors.text} /><Text>Share</Text></Pressable></View>}
    </View>
    {hasReplies && <Pressable onPress={() => setExpanded(value => !value)} style={[s.repliesToggle, { marginLeft: depth ? 42 : 42 }]}><View style={[s.replyRule, { backgroundColor: colors.border }]} /><Text style={[s.repliesText, { color: colors.accent }]}>{expanded ? "Hide replies" : `${comment.reply_count || replies.data?.length || 0} ${comment.reply_count === 1 ? "reply" : "replies"}`}</Text></Pressable>}
    {expanded && <View>{replies.isLoading ? <ActivityIndicator color={colors.accent} style={s.replyLoading} /> : replies.data?.map(reply => <CommentThread key={reply.id} postId={postId} comment={reply} depth={(depth ?? 0) + 1} onCompose={onCompose} />)}</View>}
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" }, backdrop: { ...StyleSheet.absoluteFill }, sheet: { height: "82%", borderTopWidth: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden" }, handle: { width: 38, height: 4, borderRadius: 4, alignSelf: "center", marginTop: 9 }, head: { height: 54, paddingLeft: 16, paddingRight: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth }, title: { fontFamily: "serif", fontSize: 18, fontWeight: "700" }, titleCount: { fontFamily: undefined, fontSize: 14 }, close: { width: 42, height: 44, alignItems: "center", justifyContent: "center" }, list: { paddingHorizontal: 16, paddingBottom: 18, flexGrow: 1 }, loading: { marginTop: 34 }, empty: { paddingTop: 44, fontSize: 14 }, thread: { position: "relative" }, replyThread: { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 11 }, comment: { position: "relative", paddingTop: 16 }, commentHead: { flexDirection: "row", alignItems: "center", gap: 9 }, commentName: { flex: 1, minWidth: 0 }, nameLine: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }, name: { fontSize: 14, lineHeight: 19, fontWeight: "800" }, stance: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9 }, stanceText: { fontSize: 10, fontWeight: "700" }, time: { fontSize: 11 }, more: { width: 34, height: 34, alignItems: "center", justifyContent: "center" }, commentText: { marginLeft: 42, marginTop: 6, fontSize: 14, lineHeight: 20 }, replyText: { marginLeft: 40 }, commentActions: { marginLeft: 42, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 17, flexWrap: "wrap" }, replyActions: { marginLeft: 40 }, iconAction: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 24 }, reactionCount: { fontSize: 12, fontWeight: "700" }, commentAction: { fontSize: 13, fontWeight: "700", lineHeight: 24 }, commentMenu: { position: "absolute", right: 0, top: 49, width: 138, borderWidth: 1, borderRadius: 12, elevation: 8, zIndex: 4 }, menuOption: { height: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13 }, repliesToggle: { height: 31, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 }, replyRule: { width: 24, height: StyleSheet.hairlineWidth }, repliesText: { fontSize: 13, fontWeight: "700" }, replyLoading: { marginVertical: 12 }, composer: { minHeight: 62, paddingHorizontal: 16, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth }, commentButton: { height: 42, borderWidth: 1, borderRadius: 22, justifyContent: "center", paddingHorizontal: 15 }, commentButtonText: { fontSize: 14 },
});

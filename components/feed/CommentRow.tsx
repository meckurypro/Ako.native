import { useState } from "react";
import { Pressable, View } from "react-native";
import { Avatar, Card, Text } from "@/components/core";
import { useReplies } from "@/features/feed/api";
import { isLocalCommentId } from "@/lib/outbox";
import type { Comment } from "@/features/feed/types";

export function CommentRow({ comment, postId, onReply, nested = false }: { comment: Comment; postId: string; onReply: (comment: Comment) => void; nested?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  // Queued offline and not sent yet: no server id, so no replying to it or loading its replies.
  const pending = isLocalCommentId(comment.id);
  const replies = useReplies(postId, pending ? "" : comment.id, expanded && !pending);
  return <View style={nested ? { marginLeft: 28 } : undefined}><Card style={{ flexDirection: "row", gap: 10 }}><Avatar uri={comment.author.avatar_url} name={comment.author.display_name} size={38} /><View style={{ flex: 1, gap: 4 }}><Text variant="label">{comment.author.display_name} <Text variant="caption" color="secondary">@{comment.author.username}</Text></Text>{comment.stance && <Text variant="caption" color="accent">{comment.stance.charAt(0).toUpperCase() + comment.stance.slice(1)}</Text>}<Text>{comment.content}</Text><View style={{ flexDirection: "row", gap: 18, marginTop: 4 }}>{pending ? <Text variant="caption" color="secondary">Waiting to send</Text> : <Pressable onPress={() => onReply(comment)} accessibilityRole="button"><Text variant="caption" color="accent">Reply</Text></Pressable>}{comment.reply_count > 0 && <Pressable onPress={() => setExpanded(value => !value)} accessibilityRole="button"><Text variant="caption" color="secondary">{expanded ? "Hide replies" : `View ${comment.reply_count} ${comment.reply_count === 1 ? "reply" : "replies"}`}</Text></Pressable>}</View></View></Card>{expanded && <View style={{ gap: 8, marginTop: 8 }}>{replies.isLoading ? <Text variant="caption" color="secondary">Loading replies…</Text> : replies.isError ? <Pressable onPress={() => void replies.refetch()}><Text variant="caption" color="danger">{"Couldn't load replies. Tap to retry."}</Text></Pressable> : replies.data?.map(reply => <CommentRow key={reply.id} comment={reply} postId={postId} onReply={onReply} nested />)}</View>}</View>;
}

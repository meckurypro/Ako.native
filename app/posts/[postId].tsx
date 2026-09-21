import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Chip, Input, Screen, Text } from "@/components/core";
import { ErrorState, Skeleton } from "@/components/feedback";
import { PostCard } from "@/components/feed/PostCard";
import { CommentRow } from "@/components/feed/CommentRow";
import { useComments, useCreateComment, usePost } from "@/features/feed/api";
import type { Comment, Stance } from "@/features/feed/types";

const STANCES: Stance[] = ["support", "disagree", "pushback"];

export default function PostDetail() {
  const { postId } = useLocalSearchParams<{ postId: string }>(); const id = typeof postId === "string" ? postId : ""; const router = useRouter();
  const post = usePost(id); const comments = useComments(id); const create = useCreateComment(id);
  const [text, setText] = useState(""); const [stance, setStance] = useState<Stance>(); const [replyTo, setReplyTo] = useState<Comment | null>(null); const [error, setError] = useState<string | null>(null);
  const submit = async () => { if (!text.trim()) return; setError(null); try { await create.mutateAsync({ content: text.trim(), stance, parent_comment_id: replyTo?.id }); setText(""); setStance(undefined); setReplyTo(null); } catch (err) { setError(err instanceof Error ? err.message : "Couldn't post your comment."); } };
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}><Screen><Button label="Back" variant="ghost" onPress={() => router.back()} />{post.isLoading ? <><Skeleton height={80} /><Skeleton height={240} /></> : post.isError ? <ErrorState message="This post is unavailable or you don't have access." onRetry={() => void post.refetch()} /> : post.data ? <PostCard post={post.data} /> : null}<Text variant="heading" style={{ marginTop: 24 }}>Discussion</Text><View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>{STANCES.map(item => <Chip key={item} label={item.charAt(0).toUpperCase() + item.slice(1)} selected={stance === item} onPress={() => setStance(current => current === item ? undefined : item)} />)}</View><View style={{ gap: 10, marginTop: 12 }}>{replyTo && <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text variant="caption" color="secondary">Replying to @{replyTo.author.username}</Text><Button label="Cancel" variant="ghost" onPress={() => setReplyTo(null)} /></View>}<Input label={replyTo ? "Write a reply" : "Add to the discussion"} value={text} onChangeText={setText} multiline maxLength={2000} placeholder="Share your reasoning…" />{error && <Text variant="caption" color="danger">{error}</Text>}<Button label={replyTo ? "Post reply" : "Post comment"} loading={create.isPending} disabled={!text.trim()} onPress={() => void submit()} /></View><View style={{ gap: 10, marginTop: 18 }}>{comments.isLoading ? <><Skeleton height={74} /><Skeleton height={74} /></> : comments.isError ? <ErrorState message="Couldn't load comments." onRetry={() => void comments.refetch()} /> : comments.data?.length ? comments.data.map(comment => <CommentRow key={comment.id} comment={comment} postId={id} onReply={setReplyTo} />) : <Text color="secondary" align="center" style={{ padding: 28 }}>No comments yet. Start the reasoning.</Text>}</View></Screen></KeyboardAvoidingView>;
}

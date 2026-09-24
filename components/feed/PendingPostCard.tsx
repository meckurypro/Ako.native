// File: components/feed/PendingPostCard.tsx
// Placeholder for a post that is queued in the outbox: waiting for a connection, sending, or gave up.
// Built from the queued payload alone (there is no server row yet), so it has no like/comment/gift
// controls — those need a real post id (see isLocalPostId in lib/outbox.ts).
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { Avatar, Text } from "@/components/core";
import { Icon } from "@/components/core/Icon";
import type { PendingPost } from "@/features/feed/useOutboxPosts";
import { discardOutboxItem, retryOutboxItem } from "@/lib/outbox";
import { useNetworkStatus } from "@/lib/network";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

export function PendingPostCard({ post }: { post: PendingPost }) {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { isOffline } = useNetworkStatus();
  const failed = post.status === "failed";
  const { payload } = post;
  const mediaCount = payload.media_urls?.length ?? 0;

  const confirmDiscard = () =>
    Alert.alert("Discard this post?", "It hasn't been published yet and will be deleted from this device.", [
      { text: "Keep", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => void discardOutboxItem(post.localId) },
    ]);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: failed ? colors.danger : colors.border }]}>
      <View style={styles.author}>
        <Avatar uri={profile?.avatar_url ?? null} name={profile?.display_name ?? "You"} size={32} />
        <Text style={styles.name} numberOfLines={1}>{profile?.display_name ?? "You"}</Text>
      </View>
      {payload.heading ? <Text style={styles.heading} numberOfLines={2}>{payload.heading}</Text> : null}
      {payload.content ? <Text numberOfLines={6}>{payload.content}</Text> : null}
      {mediaCount > 0 ? <Text color="muted" variant="caption">{mediaCount === 1 ? "1 attachment" : `${mediaCount} attachments`}</Text> : null}
      <View style={[styles.status, { backgroundColor: colors.surfaceElevated }]}>
        {failed ? <Icon name="alert-circle" size={15} color={colors.danger} /> : isOffline ? <Icon name="clock" size={15} color={colors.textMuted} /> : <ActivityIndicator size="small" color={colors.accent} />}
        <Text variant="caption" color={failed ? "danger" : "muted"} style={styles.statusText}>
          {failed ? "Couldn't post" : isOffline ? "Waiting for connection" : "Sending…"}
        </Text>
        {failed ? (
          <>
            <Pressable onPress={() => void retryOutboxItem(post.localId)} accessibilityRole="button" accessibilityLabel="Retry posting" hitSlop={8} style={styles.action}>
              <Icon name="refresh-cw" size={14} color={colors.accent} />
              <Text variant="caption" style={{ color: colors.accent }}>Retry</Text>
            </Pressable>
            <Pressable onPress={confirmDiscard} accessibilityRole="button" accessibilityLabel="Discard post" hitSlop={8} style={styles.action}>
              <Icon name="trash-2" size={14} color={colors.danger} />
              <Text variant="caption" color="danger">Discard</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={confirmDiscard} accessibilityRole="button" accessibilityLabel="Discard post" hitSlop={8} style={styles.action}>
            <Text variant="caption" color="muted">Discard</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", padding: 16, gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  author: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { fontWeight: "700", flexShrink: 1 },
  heading: { fontSize: 17, fontWeight: "700" },
  status: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  statusText: { flex: 1 },
  action: { flexDirection: "row", alignItems: "center", gap: 4 },
});

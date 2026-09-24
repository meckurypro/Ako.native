// File: components/messaging/FailedSendBanner.tsx
// Shown above the composer when the outbox gave up on messages/voice notes in this conversation.
// Retry puts them back in the queue with a fresh attempt budget; Discard deletes them (and, for a
// voice note, its saved recording) after a confirmation.
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/core";
import { Icon } from "@/components/core/Icon";
import { useFailedOutboxMessages } from "@/features/messaging/useFailedOutboxMessages";
import { discardOutboxItem, retryOutboxItem } from "@/lib/outbox";
import { useTheme } from "@/providers/ThemeProvider";

const clip = (text: string, max = 40) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);

export function FailedSendBanner({ conversationId }: { conversationId: string | undefined }) {
  const { colors } = useTheme();
  const items = useFailedOutboxMessages(conversationId);
  if (!items.length) return null;

  const label = items.length === 1 ? `Couldn't send: ${clip(items[0].preview)}` : `${items.length} messages couldn't be sent`;
  const retry = () => items.forEach((item) => void retryOutboxItem(item.localId));
  const confirmDiscard = () =>
    Alert.alert(items.length === 1 ? "Discard this message?" : `Discard ${items.length} messages?`, "They haven't been sent and will be deleted from this device.", [
      { text: "Keep", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => items.forEach((item) => void discardOutboxItem(item.localId)) },
    ]);

  return (
    <View style={[styles.root, { backgroundColor: colors.surfaceElevated, borderTopColor: colors.danger }]} accessibilityRole="alert">
      <Icon name="alert-circle" size={18} color={colors.danger} />
      <Text variant="caption" color="danger" numberOfLines={1} style={styles.label}>{label}</Text>
      <Pressable onPress={retry} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retry sending"><Text variant="caption" style={styles.action}>Retry</Text></Pressable>
      <Pressable onPress={confirmDiscard} hitSlop={8} accessibilityRole="button" accessibilityLabel="Discard unsent messages"><Text variant="caption" color="muted" style={styles.action}>Discard</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  label: { flex: 1 },
  action: { fontWeight: "600" },
});

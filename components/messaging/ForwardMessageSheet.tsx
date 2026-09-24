// File: components/messaging/ForwardMessageSheet.tsx
// In-app "share to another chat": pick one or more existing conversations and the
// selected message(s) are re-sent there as new messages (see useForwardMessages).
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Text } from "@/components/core";
import { Icon } from "@/components/core/Icon";
import { useConversations } from "@/features/messaging/api";
import { OfflineActionError, useForwardMessages } from "@/features/messaging/messageState";
import { useTheme } from "@/providers/ThemeProvider";

type Props = { messages: { content: string }[]; onClose: () => void; onSent: () => void };

export function ForwardMessageSheet({ messages, onClose, onSent }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const conversations = useConversations(false);
  const forward = useForwardMessages();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = (conversations.data ?? []).filter(row => !row.is_request);
    if (!q) return all;
    return all.filter(row => row.other_participant.display_name.toLowerCase().includes(q) || row.other_participant.username.toLowerCase().includes(q));
  }, [conversations.data, query]);

  const toggle = (id: string) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const send = () => {
    if (!selected.size || forward.isPending) return;
    setError(null);
    forward.mutate({ messages, targetConversationIds: [...selected] }, {
      onSuccess: onSent,
      onError: e => setError(e instanceof OfflineActionError ? e.message : "Couldn't forward that. Check your connection and try again."),
    });
  };

  return (
    <Modal transparent animationType="slide" statusBarTranslucent visible onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)" }]} onPress={onClose} />
      <View style={s.end} pointerEvents="box-none">
        <View style={[s.sheet, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom }]}>
          <View style={s.head}>
            <Text style={s.title}>Forward {messages.length > 1 ? `${messages.length} messages` : "message"}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={21} color={colors.textMuted} /></Pressable>
          </View>
          <View style={[s.search, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Icon name="search" size={16} color={colors.textMuted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search chats" placeholderTextColor={colors.textMuted} selectionColor={colors.accent} style={[s.searchInput, { color: colors.text }]} />
          </View>
          {conversations.isLoading ? <ActivityIndicator color={colors.accent} style={s.loader} /> : (
            <FlatList
              data={rows}
              keyExtractor={row => row.id}
              keyboardShouldPersistTaps="handled"
              style={s.list}
              ListEmptyComponent={<Text color="muted" align="center" style={s.empty}>{query ? "No chats match." : "No conversations to forward to yet."}</Text>}
              renderItem={({ item }) => {
                const on = selected.has(item.id);
                const name = item.is_group && item.team_page ? item.team_page.name : item.other_participant.display_name;
                const avatar = item.is_group && item.team_page ? item.team_page.avatar_url : item.other_participant.avatar_url;
                return (
                  <Pressable onPress={() => toggle(item.id)} style={s.row}>
                    <Avatar uri={avatar} name={name} size={40} />
                    <View style={s.flex}>
                      <Text numberOfLines={1} style={s.name}>{name}</Text>
                      {!!item.other_participant.username && !item.is_group && <Text color="muted" numberOfLines={1} style={s.handle}>@{item.other_participant.username}</Text>}
                    </View>
                    <Icon name={on ? "check-square" : "circle"} size={22} color={on ? colors.accent : colors.textMuted} />
                  </Pressable>
                );
              }}
            />
          )}
          {!!error && <Text color="danger" style={s.error}>{error}</Text>}
          <Pressable onPress={send} disabled={!selected.size || forward.isPending} style={[s.send, { backgroundColor: colors.accent, opacity: selected.size && !forward.isPending ? 1 : 0.4 }]}>
            {forward.isPending ? <ActivityIndicator size="small" color="#07130D" /> : <><Icon name="send" size={17} color="#07130D" /><Text style={s.sendText}>{selected.size ? `Send to ${selected.size}` : "Send"}</Text></>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  end: { flex: 1, justifyContent: "flex-end" },
  sheet: { maxHeight: "80%", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 14, fontWeight: "700" },
  search: { marginHorizontal: 16, marginBottom: 6, height: 40, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, height: 38, padding: 0, fontSize: 14 },
  loader: { marginVertical: 30 },
  list: { flexGrow: 0 },
  empty: { paddingVertical: 30, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 9 },
  flex: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "700" },
  handle: { fontSize: 12 },
  error: { fontSize: 12, paddingHorizontal: 16, paddingTop: 6 },
  send: { margin: 16, height: 46, borderRadius: 23, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  sendText: { color: "#07130D", fontSize: 14, fontWeight: "800" },
});

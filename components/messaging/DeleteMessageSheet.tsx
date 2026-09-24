// File: components/messaging/DeleteMessageSheet.tsx
// Bottom sheet that asks which scope to delete a message (or a selection) in.
// "Delete for everyone" is only offered when every target is the user's own live message.
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/core/Icon";
import { Text } from "@/components/core";
import { useTheme } from "@/providers/ThemeProvider";
import type { DeleteScope } from "@/features/messaging/messageState";

type Props = { count: number; allowEveryone: boolean; onDelete: (scope: DeleteScope) => void; onClose: () => void };

export function DeleteMessageSheet({ count, allowEveryone, onDelete, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const many = count > 1;
  return (
    <Modal transparent animationType="slide" statusBarTranslucent visible onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)" }]} onPress={onClose} />
      <View style={s.end} pointerEvents="box-none">
        <View style={[s.sheet, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom }]}>
          <Text style={s.title}>Delete {many ? `${count} messages` : "this message"}?</Text>
          <Pressable onPress={() => onDelete("me")} style={s.option}>
            <Icon name="trash-2" size={18} color={colors.danger} />
            <View style={s.flex}>
              <Text style={s.label}>Delete for me</Text>
              <Text color="muted" style={s.hint}>{`Removes ${many ? "them" : "it"} from your view only. Can't be undone.`}</Text>
            </View>
          </Pressable>
          {allowEveryone && (
            <Pressable onPress={() => onDelete("everyone")} style={[s.option, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <Icon name="trash-2" size={18} color={colors.danger} />
              <View style={s.flex}>
                <Text color="danger" style={s.label}>Delete for everyone</Text>
                <Text color="muted" style={s.hint}>{`Replaces ${many ? "them" : "it"} with "message deleted" for both of you. Can't be undone.`}</Text>
              </View>
            </Pressable>
          )}
          <Pressable onPress={onClose} style={[s.cancel, { borderTopColor: colors.border }]}><Text color="muted" align="center" style={s.label}>Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  end: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 14, fontWeight: "700", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  option: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  flex: { flex: 1 },
  label: { fontSize: 14, fontWeight: "600" },
  hint: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  cancel: { paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
});

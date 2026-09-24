// File: components/feedback/ConfirmDialog.tsx
//
// A blocking confirm step for actions with real consequences — unfollow
// a mutual/private follow, remove a follower, block someone. Web pairs
// these actions with context-specific copy explaining what happens
// next; this is the native equivalent of that same pause, not a bare
// OS Alert (Alert.alert can't take a danger-styled confirm button or
// a pending state while the mutation is in flight).
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/core";
import { useTheme } from "@/providers/ThemeProvider";

export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  danger,
  pending,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.wrap}>
        <Pressable
          accessibilityLabel="Dismiss"
          onPress={onCancel}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="heading">{title}</Text>
          <Text color="secondary" style={styles.desc}>
            {description}
          </Text>
          <View style={styles.row}>
            <Pressable onPress={onCancel} style={[styles.button, { borderColor: colors.border }]}>
              <Text color="secondary" style={styles.buttonText}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              disabled={pending}
              onPress={onConfirm}
              style={[
                styles.button,
                { backgroundColor: danger ? colors.danger : colors.accent, borderColor: "transparent", opacity: pending ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.buttonText, { color: colors.onAccent, fontWeight: "700" }]}>
                {pending ? "…" : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 20 },
  desc: { marginTop: 4, marginBottom: 18 },
  row: { flexDirection: "row", gap: 10 },
  button: { flex: 1, height: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 15, fontWeight: "600" },
});

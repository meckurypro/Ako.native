// File: components/ConfirmDialog.tsx
//
// Port of web's src/components/ConfirmDialog.tsx — the one place every "are
// you sure?" prompt goes through (delete a chat/message/post, unfollow,
// remove a follower). Reversible, low-stakes actions (archive, hide, pin,
// mute) should never use it. Built on <Modal>, so it's the fixed dark-glass
// panel; `danger` only changes the tint (warm icon chip + desaturated red
// confirm, vs. sage confirm), not the panel.
//
// No platform differences beyond Tailwind → StyleSheet; the wording, sizes
// and spacing are web's (text-[15px] title, text-sm description, gap-4 /
// mt-7 / gap-3, py-3 pill buttons).
import { AlertTriangle } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Modal } from "./Modal";
import { overlayColors } from "../lib/theme";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button + warning icon. Defaults true — this component only exists for things worth pausing on. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal onClose={onCancel} role="alertdialog" ariaLabel={title}>
      <View style={styles.header}>
        {danger && (
          <View style={styles.iconChip}>
            <AlertTriangle size={19} color={overlayColors.danger} />
          </View>
        )}
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.pressed]}
        >
          <Text style={[styles.buttonText, { color: overlayColors.ink }]}>{cancelLabel}</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: danger ? overlayColors.danger : overlayColors.accent },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.buttonText, { color: overlayColors.surface }]}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: 16 }, // gap-4
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: overlayColors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: { flex: 1, paddingTop: 2 }, // min-w-0 pt-0.5
  title: { fontSize: 15, fontWeight: "500", lineHeight: 20.6, color: overlayColors.ink }, // leading-snug
  description: {
    fontSize: 14,
    lineHeight: 22.75, // leading-relaxed
    marginTop: 8,
    color: overlayColors.inkMuted,
  },
  buttons: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 28 }, // gap-3 mt-7
  button: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: "center" },
  cancel: { backgroundColor: overlayColors.surfaceRaised },
  buttonText: { fontSize: 14, fontWeight: "500" },
  pressed: { opacity: 0.85 },
});

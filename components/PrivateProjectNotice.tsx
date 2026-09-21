// File: components/PrivateProjectNotice.tsx
//
// Replaces a private project's description/media/buy-action region for a
// non-member visitor. Same idea as the private-profile lock, scoped to one
// project: the only way in is the owner adding the visitor, hence a
// message button rather than any request-to-buy flow.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Lock, MessageCircle } from "lucide-react-native";
import { useTheme } from "../lib/theme";

interface PrivateProjectNoticeProps {
  onMessage: () => void;
  messagePending: boolean;
}

export function PrivateProjectNotice({ onMessage, messagePending }: PrivateProjectNoticeProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas, borderColor: colors.border }]}>
      <Lock size={22} color={colors.accent} style={styles.lock} />
      <Text style={[styles.title, { color: colors.ink }]}>This project is private</Text>
      <Text style={[styles.body, { color: colors.inkMuted }]}>
        Only people the creator has given access to can view this. Message them to ask for access.
      </Text>
      <Pressable
        onPress={onMessage}
        disabled={messagePending}
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: colors.accent }, messagePending && { opacity: 0.5 }]}
      >
        <MessageCircle size={15} color={colors.canvas} />
        <Text style={[styles.buttonText, { color: colors.canvas }]}>
          {messagePending ? "Opening…" : "Message for access"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // mt-3 flex-col items-center text-center py-6 px-4 rounded-xl border
  root: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  lock: { marginBottom: 8 },
  title: { fontSize: 14, fontWeight: "500", textAlign: "center" },
  // text-xs mt-1 max-w-xs
  body: { fontSize: 12, lineHeight: 16, marginTop: 4, maxWidth: 320, textAlign: "center" },
  // mt-4 flex items-center gap-1.5 px-4 py-2 rounded-full
  button: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  buttonText: { fontSize: 14, fontWeight: "500" },
});

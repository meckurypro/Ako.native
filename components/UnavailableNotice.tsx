// File: components/UnavailableNotice.tsx
//
// Shown in place of a post or project's real content once it's been
// deleted or archived. `reason` should already be a complete, human-
// readable sentence ("You deleted this post.") — this only provides the
// consistent shell. Pass undefined when no reason can be attributed.
import { StyleSheet, Text, View } from "react-native";
import { EyeOff } from "lucide-react-native";
import { useTheme } from "../lib/theme";

export function UnavailableNotice({
  kind,
  reason,
}: {
  kind: "post" | "project";
  reason?: string | null;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.root}>
      <View style={[styles.iconCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <EyeOff size={20} color={colors.inkMuted} />
      </View>
      <Text style={[styles.title, { color: colors.ink }]}>This {kind} is no longer available</Text>
      {reason ? <Text style={[styles.reason, { color: colors.inkMuted }]}>{reason}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // flex-col items-center text-center py-16 px-6
  root: { alignItems: "center", paddingVertical: 64, paddingHorizontal: 24 },
  // w-12 h-12 rounded-full bg-surface border mb-3
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  // font-medium mb-1
  title: { fontSize: 16, fontWeight: "500", marginBottom: 4, textAlign: "center" },
  reason: { fontSize: 14, textAlign: "center" },
});

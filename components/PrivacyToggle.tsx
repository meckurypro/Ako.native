// File: components/PrivacyToggle.tsx
//
// "Private project" switch row — used on CreateProject and EditProject so
// a host can set this before saving or flip it later.
import { StyleSheet, Text, View } from "react-native";
import { EyeOff } from "lucide-react-native";
import { Switch } from "./Switch";
import { useTheme } from "../lib/theme";

interface PrivacyToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function PrivacyToggle({ checked, onChange }: PrivacyToggleProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.left}>
        <View style={styles.icon}>
          <EyeOff size={18} color={colors.inkMuted} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.ink }]}>Private project</Text>
          <Text style={[styles.body, { color: colors.inkMuted }]}>
            Not listed anywhere, and not open to anyone by link — only people you add can see or open it.
          </Text>
        </View>
      </View>
      <Switch checked={checked} onChange={onChange} accessibilityLabel="Private project" />
    </View>
  );
}

const styles = StyleSheet.create({
  // bg-surface rounded-xl p-4 mb-6 / flex items-center justify-between gap-3
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  left: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { flexShrink: 0 },
  copy: { flex: 1 },
  title: { fontSize: 14, fontWeight: "500" },
  body: { fontSize: 12, lineHeight: 16 },
});

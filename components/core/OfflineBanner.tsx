// File: components/core/OfflineBanner.tsx
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Text";
import { Icon } from "./Icon";
import { useNetworkStatus } from "@/lib/network";
import { useTheme } from "@/providers/ThemeProvider";

export function OfflineBanner() {
  const { isOffline } = useNetworkStatus();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (!isOffline) return null;

  return (
    <View style={[styles.root, { top: insets.top, backgroundColor: colors.textMuted }]} pointerEvents="none">
      <Icon name="wifi-off" size={13} color={colors.background} />
      <Text style={[styles.label, { color: colors.background }]}>No connection — showing saved messages</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", left: 0, right: 0, zIndex: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6 },
  label: { fontSize: 12, fontWeight: "600" },
});

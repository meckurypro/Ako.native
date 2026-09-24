// File: components/profile/TierBadge.tsx
//
// Ports web's TierBadge.tsx: a small pill next to a profile's name for
// every tier above the default. "newcomer" deliberately renders
// nothing — showing a badge for the default tier is visual noise on
// every brand-new account, not a real distinction.
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/core";
import { useTheme } from "@/providers/ThemeProvider";

const TIER_LABELS: Record<string, string | null> = {
  newcomer: null,
  contributor: "Contributor",
  publisher: "Publisher",
  host: "Host",
  creator_business: "Creator",
};

export function TierBadge({ tier }: { tier?: string | null }) {
  const { colors } = useTheme();
  const label = tier ? TIER_LABELS[tier] : null;
  if (!label) return null;

  return (
    <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
      <Text color="accent" style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  label: { fontSize: 11, fontWeight: "700" },
});

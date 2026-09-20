// File: components/TierBadge.tsx
// Direct port of web's src/components/TierBadge.tsx — no native-specific
// differences, just JSX/className → Text/style.
import { StyleSheet, Text } from "react-native";
import type { Tier } from "../types/database";
import { useTheme } from "../lib/theme";

const TIER_LABELS: Record<Tier, string | null> = {
  newcomer: null, // no badge for the default tier — avoid visual noise
  contributor: "Contributor",
  publisher: "Publisher",
  host: "Host",
  creator_business: "Creator",
};

export function TierBadge({ tier }: { tier: Tier }) {
  const { colors } = useTheme();
  const label = TIER_LABELS[tier];
  if (!label) return null;

  return (
    <Text style={[styles.badge, { color: colors.accent, backgroundColor: colors.accentSoft }]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  // web: text-xs font-medium px-2 py-0.5 rounded-full
  badge: {
    fontSize: 12,
    fontWeight: "500",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
});

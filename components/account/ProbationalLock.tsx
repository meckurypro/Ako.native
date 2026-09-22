// File: components/account/ProbationalLock.tsx
//
// Mirrors web's src/components/ProbationalPageLock.tsx. Wraps a whole
// screen for the probational (pending-review) partial-access system.
// When the given feature is locked for the current probational user,
// the screen still renders underneath (layout/chrome stays consistent)
// but is blurred and inert, with a banner explaining it unlocks once
// the account is approved. Everyone else sees the screen normally —
// this component then does nothing at all.
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { Icon } from "@/components/core/Icon";
import { Text } from "@/components/core";
import { useTheme } from "@/providers/ThemeProvider";
import { useProbationalLock } from "@/features/account/probational";

export function ProbationalLock({ featureKey, children }: { featureKey: string; children: ReactNode }) {
  const locked = useProbationalLock(featureKey);
  const { colors, isDark } = useTheme();

  if (!locked) return <>{children}</>;

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.underlay}>
        {children}
      </View>
      <BlurView intensity={isDark ? 30 : 40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: isDark ? 0.35 : 0.25 }]} />
      <View style={styles.bannerWrap} pointerEvents="box-none">
        <View style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
            <Icon name="lock" size={18} color={colors.accent} />
          </View>
          <Text variant="body" align="center" style={{ fontWeight: "600", marginBottom: 4 }}>
            This unlocks once your account is approved
          </Text>
          <Text color="secondary" align="center" variant="caption">
            You're still in the review period — check back soon, or we'll be in touch.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  underlay: { flex: 1, opacity: 0.6 },
  bannerWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "flex-start", paddingTop: 120, paddingHorizontal: 24 },
  banner: { maxWidth: 320, width: "100%", borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20, alignItems: "center" },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 12 },
});

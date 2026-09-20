// File: components/VerifiedBadge.tsx
// Port of web's src/components/VerifiedBadge.tsx — the Admin-assigned
// identity badge (see AKỌ — ADMIN VERIFIED BADGE ASSIGNMENT & BULK
// VERIFICATION SYSTEM). Independent of account approval, KYC, and
// founding-user status — only ever reflects profiles.is_verified,
// written exclusively via admin_set_verified/admin_bulk_set_verified.
//
// Web draws the gradient disc with a CSS `linear-gradient(...)` on a
// <span> and layers a Lucide <Check> on top via normal box stacking.
// RN has no CSS gradients, so the disc is drawn with react-native-svg
// (Svg + LinearGradient + Circle) and the Check icon is layered over
// it with a plain absolute-fill View — same visual result, same accent
// tokens (colors.accent / colors.accentHover) so it still tracks
// light/dark theming rather than a hardcoded color.
//
// Web's soft drop-shadow glow behind the disc becomes RN's shadow*
// properties (iOS) + elevation (Android) on the wrapping View.
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { Check } from "lucide-react-native";
import { useTheme } from "../lib/theme";

function BadgeIcon({ size }: { size: number }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.iconWrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          shadowColor: colors.accent,
        },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="verifiedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.accentHover} />
            <Stop offset="100%" stopColor={colors.accent} />
          </LinearGradient>
        </Defs>
        <Circle cx="50" cy="50" r="48" fill="url(#verifiedGrad)" />
      </Svg>
      <View style={styles.checkWrap}>
        <Check size={Math.round(size * 0.62)} strokeWidth={3.25} color="#FFFFFF" />
      </View>
    </View>
  );
}

export function VerifiedBadge({
  size = 15,
  // Spells the mark out as a "Verified" pill instead of the bare icon —
  // used on ProfilePage/PagePage where there's room for it to be
  // prominent, rather than the compact icon-only mark PostCard uses.
  label = false,
}: {
  size?: number;
  label?: boolean;
}) {
  const { colors } = useTheme();

  if (!label) {
    return (
      <View accessibilityLabel="Verified" accessibilityRole="image">
        <BadgeIcon size={size} />
      </View>
    );
  }

  return (
    <View
      style={[styles.pill, { backgroundColor: colors.accentSoft }]}
      accessibilityLabel="Verified"
      accessibilityRole="image"
    >
      <BadgeIcon size={size} />
      <Text style={[styles.pillText, { color: colors.accent }]}>Verified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    // web: 0 1px 3px rgba(accent, 0.55)
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.55,
    shadowRadius: 3,
    elevation: 2,
  },
  checkWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  // web: gap-1.5 rounded-full pl-1 pr-2.5 py-1
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
  },
  pillText: { fontSize: 13, fontWeight: "600" },
});

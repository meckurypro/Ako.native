// components/core/VerifiedBadge.tsx
//
// Ports web's src/components/VerifiedBadge.tsx: the admin-assigned
// identity mark (profiles.is_verified), styled as a solid gradient
// disc with a white checkmark (Twitter/Meta-style) rather than a flat
// outline icon or a generic label chip — reads as a deliberate,
// premium mark next to the tier badge rather than just more chip
// noise. Gradient runs off the existing accent tokens so it still
// tracks light/dark theming, same as web.
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "./Icon";
import { useTheme } from "@/providers/ThemeProvider";
import { fonts } from "@/theme/fonts";
import { Text } from "./Text";

function BadgeIcon({ size }: { size: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        shadowColor: colors.accent,
        shadowOpacity: 0.55,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      }}
    >
      <LinearGradient
        colors={[colors.accentPressed, colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.25)",
        }}
      >
        <Icon name="check" size={Math.round(size * 0.62)} strokeWidth={3.25} color="#FFFFFF" />
      </LinearGradient>
    </View>
  );
}

export function VerifiedBadge({
  size = 15,
  // Spells the mark out as a "Verified" pill instead of the bare icon —
  // for profile/page screens where there's room for it to be prominent,
  // matching web's `label` prop. PostCard uses the compact icon-only
  // default, same as web.
  label = false,
}: {
  size?: number;
  label?: boolean;
}) {
  const { colors } = useTheme();
  if (!label) {
    return (
      <View accessibilityRole="image" accessibilityLabel="Verified">
        <BadgeIcon size={size} />
      </View>
    );
  }
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Verified"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        borderRadius: 999,
        backgroundColor: colors.accentSoft,
        paddingLeft: 4,
        paddingRight: 10,
        paddingVertical: 4,
      }}
    >
      <BadgeIcon size={size} />
      {/* text-[13px] font-semibold text-accent on web */}
      <Text style={{ fontSize: 13, fontFamily: fonts.body.semibold }} color="accent">
        Verified
      </Text>
    </View>
  );
}

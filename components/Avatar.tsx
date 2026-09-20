// File: components/Avatar.tsx
import { Image, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/theme";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
}

// Web: sm w-8/text-xs, md w-10/text-sm, xl w-16/text-xl, lg w-20/text-2xl.
const SIZES = {
  sm: { box: 32, font: 12 },
  md: { box: 40, font: 14 },
  xl: { box: 64, font: 20 },
  lg: { box: 80, font: 24 },
} as const;

export function Avatar({ src, name, size = "md" }: AvatarProps) {
  const { colors } = useTheme();
  const { box, font } = SIZES[size];

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (src) {
    return (
      <Image
        source={{ uri: src }}
        accessibilityLabel={name}
        style={{ width: box, height: box, borderRadius: box / 2 }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: box, height: box, borderRadius: box / 2, backgroundColor: colors.accentSoft },
      ]}
    >
      <Text style={{ color: colors.accent, fontSize: font, fontWeight: "500" }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
});

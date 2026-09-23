import { Image } from "expo-image";
import { View } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { Text } from "./Text";
type Props = { uri?: string | null; name: string; size?: number; presence?: boolean };
export function Avatar({ uri, name, size = 48, presence }: Props) {
  const { colors, radii } = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || "A";
  return <View style={{ width: size, height: size }}>{uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radii.full }} contentFit="cover" transition={160} cachePolicy="disk" /> : <View style={{ width: size, height: size, borderRadius: radii.full, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}><Text variant="heading" color="accent">{initial}</Text></View>}{presence && <View accessibilityLabel="Online" style={{ position: "absolute", right: 0, bottom: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.presence, borderWidth: 2, borderColor: colors.surface }} />}</View>;
}

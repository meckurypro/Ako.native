import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/providers/ThemeProvider";
import { PressableScale } from "./PressableScale";

type Props = { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; disabled?: boolean };
export function IconButton({ icon, label, onPress, disabled }: Props) {
  const { colors, radii } = useTheme();
  return <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} hitSlop={8} style={{ width: 44, height: 44, borderRadius: radii.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSoft }}><MaterialCommunityIcons name={icon} size={22} color={colors.accent} /></PressableScale>;
}

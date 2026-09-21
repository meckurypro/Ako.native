import { useTheme } from "@/providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";
export function Chip({ label, selected, onPress, disabled }: { label: string; selected?: boolean; onPress?: () => void; disabled?: boolean }) {
  const { colors, radii } = useTheme();
  return <PressableScale accessibilityRole="button" accessibilityState={{ selected, disabled }} onPress={onPress} disabled={disabled} style={{ alignSelf: "flex-start", borderRadius: radii.full, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accentSoft : colors.surface, paddingHorizontal: 13, paddingVertical: 8 }}><Text variant="label" color={selected ? "accent" : "secondary"}>{label}</Text></PressableScale>;
}

import { View } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { Text } from "./Text";
export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const { colors, radii } = useTheme();
  const color = tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "danger" ? colors.danger : colors.textSecondary;
  return <View style={{ alignSelf: "flex-start", borderRadius: radii.full, backgroundColor: colors.accentSoft, paddingHorizontal: 9, paddingVertical: 4 }}><Text variant="caption" style={{ color }}>{label}</Text></View>;
}

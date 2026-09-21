import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { useTheme } from "@/providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

type Props = { label: string; onPress?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; disabled?: boolean; loading?: boolean; icon?: IconName; accessibilityHint?: string };
export function Button({ label, onPress, variant = "primary", disabled, loading, icon, accessibilityHint }: Props) {
  const { colors, radii, spacing } = useTheme();
  const backgrounds = { primary: colors.accent, secondary: colors.accentSoft, ghost: "transparent", danger: colors.danger };
  const foreground = variant === "primary" || variant === "danger" ? colors.onAccent : variant === "secondary" ? colors.accent : colors.text;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint} onPress={onPress} disabled={disabled || loading} style={[styles.button, { backgroundColor: backgrounds[variant], borderRadius: radii.full, paddingHorizontal: spacing[5] }]}>
      {loading ? <ActivityIndicator color={foreground} /> : <View style={styles.content}>{icon && <Icon name={icon} color={foreground} size={20} />}<Text variant="label" style={{ color: foreground }}>{label}</Text></View>}
    </PressableScale>
  );
}
const styles = StyleSheet.create({ button: { minHeight: 48, alignItems: "center", justifyContent: "center" }, content: { flexDirection: "row", alignItems: "center", gap: 8 } });

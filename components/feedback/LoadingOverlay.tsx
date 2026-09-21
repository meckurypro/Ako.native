import { ActivityIndicator, Modal, View } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { Text } from "@/components/core";
export function LoadingOverlay({ visible, label = "Please wait" }: { visible: boolean; label?: string }) { const { colors, radii } = useTheme(); return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent><View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlay }}><View style={{ alignItems: "center", gap: 12, padding: 24, borderRadius: radii.lg, backgroundColor: colors.surface }}><ActivityIndicator color={colors.accent} /><Text variant="label">{label}</Text></View></View></Modal>; }

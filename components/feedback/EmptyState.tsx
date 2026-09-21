import { Icon, type IconName } from "@/components/core/Icon";
import { View } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { Button, Heading, Text } from "@/components/core";
type Props = { icon?: IconName; title: string; message: string; actionLabel?: string; onAction?: () => void };
export function EmptyState({ icon = "sprout", title, message, actionLabel, onAction }: Props) { const { colors } = useTheme(); return <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24, gap: 10 }}><Icon name={icon} size={36} color={colors.accent} /><Heading align="center">{title}</Heading><Text color="secondary" align="center">{message}</Text>{actionLabel && onAction && <View style={{ marginTop: 8 }}><Button label={actionLabel} onPress={onAction} variant="secondary" /></View>}</View>; }

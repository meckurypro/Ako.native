// File: components/projects/PrivateProjectNotice.tsx
import { View } from "react-native";
import { Button, Icon, Text } from "@/components/core";
import { useTheme } from "@/providers/ThemeProvider";

// Replaces a private project's description/media/buy region for a non-member visitor (mirrors web's PrivateProjectNotice). The only way in is the owner adding the visitor as a member, so this offers a message button rather than a purchase flow.
export function PrivateProjectNotice({ onMessage, messagePending }: { onMessage: () => void; messagePending: boolean }) {
  const { colors, radii } = useTheme();
  return (
    <View style={{ marginTop: 12, alignItems: "center", paddingVertical: 24, paddingHorizontal: 16, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
      <View style={{ marginBottom: 8 }}><Icon name="lock" size={22} color={colors.accent} /></View>
      <Text variant="label" align="center">This project is private</Text>
      <Text variant="caption" color="secondary" align="center" style={{ marginTop: 4, maxWidth: 280 }}>Only people the creator has given access to can view this. Message them to ask for access.</Text>
      <View style={{ marginTop: 16 }}><Button label="Message for access" icon="message-circle" loading={messagePending} onPress={onMessage} /></View>
    </View>
  );
}

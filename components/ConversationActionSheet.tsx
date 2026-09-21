// File: components/ConversationActionSheet.tsx
//
// Long-press action sheet for a conversation row — pin/unpin to top,
// archive, delete (hides the chat for this user only), or enter
// multi-select mode. onDelete just opens the caller's confirmation step;
// this sheet never deletes directly.
import { StyleSheet, Text } from "react-native";
import { Pin, PinOff, Archive, Trash2, CheckSquare } from "lucide-react-native";
import { BottomSheet, SheetCancel, SheetRow } from "./BottomSheet";
import { useTheme } from "../lib/theme";

interface ConversationActionSheetProps {
  displayName: string;
  isPinned: boolean;
  onTogglePin: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onSelect: () => void;
  onClose: () => void;
}

export function ConversationActionSheet({
  displayName,
  isPinned,
  onTogglePin,
  onArchive,
  onDelete,
  onSelect,
  onClose,
}: ConversationActionSheetProps) {
  const { colors } = useTheme();

  return (
    <BottomSheet onClose={onClose} ariaLabel="Conversation actions">
      <Text numberOfLines={1} style={[styles.name, { color: colors.inkMuted }]}>
        {displayName}
      </Text>

      <SheetRow
        icon={isPinned ? PinOff : Pin}
        label={isPinned ? "Unpin from top" : "Pin to top"}
        onPress={onTogglePin}
      />
      <SheetRow icon={Archive} label="Archive" onPress={onArchive} />
      <SheetRow icon={CheckSquare} label="Select chats" onPress={onSelect} />
      <SheetRow icon={Trash2} label="Delete chat" danger onPress={onDelete} />

      <SheetCancel />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // px-4 pt-4 pb-2 text-xs truncate
  name: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontSize: 12 },
});

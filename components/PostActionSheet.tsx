// File: components/PostActionSheet.tsx
//
// Bottom sheet for a post's own author — Edit / Archive / Delete. Each
// row closes the sheet first, then runs its action (see BottomSheet), so
// `onDelete` can safely open a <ConfirmDialog>.
import { Pencil, Archive, RotateCcw, Trash2 } from "lucide-react-native";
import { BottomSheet, SheetCancel, SheetRow } from "./BottomSheet";

interface PostActionSheetProps {
  canEdit: boolean;
  isArchived: boolean;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function PostActionSheet({
  canEdit,
  isArchived,
  onEdit,
  onToggleArchive,
  onDelete,
  onClose,
}: PostActionSheetProps) {
  return (
    <BottomSheet onClose={onClose} ariaLabel="Post actions">
      {canEdit && <SheetRow icon={Pencil} label="Edit" onPress={onEdit} />}

      <SheetRow
        icon={isArchived ? RotateCcw : Archive}
        label={isArchived ? "Unarchive" : "Archive"}
        onPress={onToggleArchive}
      />

      <SheetRow icon={Trash2} label="Delete post" danger onPress={onDelete} />

      <SheetCancel />
    </BottomSheet>
  );
}

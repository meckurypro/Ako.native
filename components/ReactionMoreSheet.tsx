// File: components/ReactionMoreSheet.tsx
//
// Long-pressing any of ReactionTray's visible icons (or tapping "···") opens
// this — a full grid of every engagement action for the post (all secondary
// actions regardless of usage rank, plus owner management), so nothing is out
// of reach just because it didn't make the visible slots.
//
// Built on BottomSheet, like PostActionSheet. Each grid cell runs its action
// through the sheet's `select`, which closes the sheet first and then runs the
// action — the native equivalent of web's runAfterDismiss, and what lets an
// action open a <ConfirmDialog> (Delete, Archive, Prioritize) without iOS
// dropping the second modal.
//
// web: grid grid-cols-4 gap-y-4 px-2 pt-5 pb-2; cell = flex-col items-center
// gap-1.5, label text-[11px] leading-tight text-ink-muted, "Label (count)".
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheet, SheetCancel, useSheet } from "./BottomSheet";
import type { EngagementAction } from "./ReactionTray";
import { useTheme } from "../lib/theme";

function GridCell({ action }: { action: EngagementAction }) {
  const { colors } = useTheme();
  const { select } = useSheet();

  return (
    <Pressable
      onPress={() => select(action.onClick)}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={styles.cell}
    >
      {action.icon}
      <Text style={[styles.label, { color: colors.inkMuted }]}>
        {action.label}
        {action.count !== null ? ` (${action.count})` : ""}
      </Text>
    </Pressable>
  );
}

export function ReactionMoreSheet({ actions, onClose }: { actions: EngagementAction[]; onClose: () => void }) {
  return (
    <BottomSheet onClose={onClose} ariaLabel="More actions">
      <View style={styles.grid}>
        {actions.map((action) => (
          <GridCell key={action.key} action={action} />
        ))}
      </View>
      <SheetCancel />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 16, paddingHorizontal: 8, paddingTop: 20, paddingBottom: 8 },
  cell: { width: "25%", alignItems: "center", gap: 6 },
  label: { fontSize: 11, lineHeight: 14, textAlign: "center" },
});

// File: components/ReactionTray.tsx
//
// The engagement row under a post: Like pinned left (with an optional small
// "Comments: N" label under it), up to 3 ranked-by-usage actions in the middle,
// and a fixed "···" more button on the right — 5 equal-width slots in total.
// Purely presentational; PostCard builds the action lists.
//
// Same contract as web: tapping an icon calls its onClick; long-pressing any
// visible icon calls `onOpenMore` (PostCard opens ReactionMoreSheet with every
// action). `disabled` freezes the whole tray (archived / unavailable content)
// and dims it to 40%.
//
// Native differences:
//   - Long-press is Pressable's onLongPress (450ms, same as web). RN cancels
//     it if the finger drifts or a scroll takes over, so web's pointer-capture
//     and 10px move-cancel bookkeeping isn't needed. The long-press haptic
//     from 06_Haptics.md (impactAsync Light) is a follow-up once expo-haptics
//     is added.
//   - `data-swipeable-ignore` (keeping the tab pager off the tray's own
//     gestures) has no equivalent: the tray has no horizontal gesture of its
//     own now.
//   - The "Comments: N" label sits in a fixed-width box centered on the Like
//     column so it can overhang the column like web's whitespace-nowrap text.
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/theme";

export interface EngagementAction {
  key: string;
  label: string; // accessibility label; also the visible label in the long-press sheet
  icon: ReactNode;
  /** null → no count shown */
  count: number | null;
  onClick: () => void;
}

interface ReactionTrayProps {
  /** Like — always visible, fixed left. */
  leftActions: EngagementAction[];
  /** Top-ranked (most-used) secondary actions — fill the remaining slots. */
  middleActions: EngagementAction[];
  /** Fixed-right actions — the "···" more button. */
  rightActions: EngagementAction[];
  /** Small text row directly under the left fixed group ("Comments: N"). */
  belowLeftLabel?: { text: string; onClick: () => void };
  /** Long-pressing any visible icon calls this, if provided. */
  onOpenMore?: () => void;
  /** Freezes the entire tray and dims it. */
  disabled?: boolean;
}

const VISIBLE_SLOTS = 5;
const LONG_PRESS_MS = 450;

function ActionButton({
  action,
  widthPercent,
  onOpenMore,
  disabled,
}: {
  action: EngagementAction;
  widthPercent: number;
  onOpenMore?: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={action.onClick}
      onLongPress={onOpenMore && !disabled ? onOpenMore : undefined}
      delayLongPress={LONG_PRESS_MS}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.action, { width: `${widthPercent}%`, opacity: disabled ? 0.4 : 1 }]}
    >
      {action.icon}
      {action.count !== null && <Text style={[styles.count, { color: colors.ink }]}>{action.count}</Text>}
    </Pressable>
  );
}

export function ReactionTray({
  leftActions,
  middleActions,
  rightActions,
  belowLeftLabel,
  onOpenMore,
  disabled,
}: ReactionTrayProps) {
  const { colors } = useTheme();
  const slotPct = 100 / VISIBLE_SLOTS;
  // Reserved by capacity, not by middleActions.length — keeps rightActions
  // pinned to the true right edge instead of drifting inward after a short
  // middle group.
  const middleSlotCount = Math.max(0, VISIBLE_SLOTS - leftActions.length - rightActions.length);
  const middleItemWidth = 100 / Math.max(middleActions.length, 1);

  return (
    <View style={styles.tray}>
      <View style={[styles.leftColumn, { width: `${leftActions.length * slotPct}%` }]}>
        <View style={styles.leftRow}>
          {leftActions.map((action) => (
            <ActionButton
              key={action.key}
              action={action}
              widthPercent={100 / leftActions.length}
              onOpenMore={onOpenMore}
              disabled={disabled}
            />
          ))}
        </View>

        {belowLeftLabel && (
          <Pressable onPress={belowLeftLabel.onClick} style={styles.belowLabel}>
            <Text numberOfLines={1} style={[styles.belowLabelText, { color: colors.inkMuted }]}>
              {belowLeftLabel.text}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.group, { width: `${middleSlotCount * slotPct}%` }]}>
        {middleActions.map((action) => (
          <ActionButton
            key={action.key}
            action={action}
            widthPercent={middleItemWidth}
            onOpenMore={onOpenMore}
            disabled={disabled}
          />
        ))}
      </View>

      <View style={[styles.group, { width: `${rightActions.length * slotPct}%` }]}>
        {rightActions.map((action) => (
          <ActionButton
            key={action.key}
            action={action}
            widthPercent={100 / rightActions.length}
            onOpenMore={onOpenMore}
            disabled={disabled}
          />
        ))}
      </View>
    </View>
  );
}

// web: flex items-start mt-4 pt-4 pb-1 w-full; button: flex-row items-center
// justify-center gap-2 py-1.5; count: text-sm font-semibold leading-none;
// below-label: text-xs font-medium leading-none mt-2.
const styles = StyleSheet.create({
  tray: { flexDirection: "row", alignItems: "flex-start", marginTop: 16, paddingTop: 16, paddingBottom: 4, width: "100%" },
  leftColumn: { alignItems: "center", flexShrink: 0 },
  leftRow: { flexDirection: "row", width: "100%" },
  group: { flexDirection: "row", flexShrink: 0 },
  action: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 6, flexShrink: 0 },
  count: { fontSize: 14, fontWeight: "600", lineHeight: 14 },
  belowLabel: { width: 100, alignItems: "center", marginTop: 8 },
  belowLabelText: { fontSize: 12, fontWeight: "500", lineHeight: 12 },
});

// File: components/messaging/MessageActionMenu.tsx
// Long-press overlay for a message: quick-react emoji strip above the bubble, a top action
// bar (Reply, Forward, Copy, Star, Delete, More) and a "More" popover (Select, Pin, Hide,
// Share). Same order and rules as web's components/MessageActionMenu.tsx; a tombstoned
// message collapses to just Select and Delete-for-me.
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/core/Icon";
import { Text } from "@/components/core";
import { useTheme } from "@/providers/ThemeProvider";

export type MessageAnchor = { x: number; y: number; width: number; height: number };

type Props = {
  anchor: MessageAnchor;
  content: string;
  /** False for voice notes: there's no text to copy. */
  canCopy: boolean;
  isMine: boolean;
  isDeleted: boolean;
  isStarred: boolean;
  isPinned: boolean;
  emojis: string[];
  myReaction: string | null;
  onReact: (emoji: string) => void;
  onRemoveReaction: () => void;
  onOpenFullPicker: () => void;
  onReply: () => void;
  onForward: () => void;
  onCopy: () => void;
  onToggleStar: () => void;
  onDeletePress: () => void;
  onTogglePin: () => void;
  onHide: () => void;
  onShare: () => void;
  onSelect: () => void;
  onClose: () => void;
};

const PILL_HEIGHT = 56;
const BAR_HEIGHT = 56;

export function MessageActionMenu(props: Props) {
  const { anchor, content, isMine, isDeleted, isStarred, isPinned, emojis, myReaction, onClose } = props;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);
  const [screen, setScreen] = useState({ width: 0, height: 0 });

  // Runs the action, then closes — every button in this menu ends the long-press state.
  const run = (fn: () => void) => () => { fn(); onClose(); };

  const barBottom = insets.top + BAR_HEIGHT;
  const pillAbove = anchor.y > barBottom + PILL_HEIGHT + 16;
  const pillTop = pillAbove ? anchor.y - PILL_HEIGHT - 8 : anchor.y + anchor.height + 8;
  const centerX = anchor.x + anchor.width / 2;
  // A horizontal ScrollView has no intrinsic width, so the pill's width is the measured
  // content width capped to the screen; it's then centred on the bubble and clamped in.
  const pillWidth = screen.width ? Math.min(contentWidth, screen.width - 16) : 0;
  const pillLeft = pillWidth ? Math.min(Math.max(centerX - pillWidth / 2, 8), screen.width - pillWidth - 8) : 8;

  const bar: { key: string; icon: IconName; label: string; onPress: () => void; color?: string; fill?: boolean }[] = [];
  if (!isDeleted) {
    bar.push({ key: "reply", icon: "reply", label: "Reply", onPress: run(props.onReply) });
    bar.push({ key: "forward", icon: "forward", label: "Forward", onPress: run(props.onForward) });
    if (props.canCopy) bar.push({ key: "copy", icon: "copy", label: "Copy", onPress: run(props.onCopy) });
    bar.push({ key: "star", icon: "star", label: isStarred ? "Unstar" : "Star", onPress: run(props.onToggleStar), color: isStarred ? colors.accent : undefined, fill: isStarred });
  }
  if (isMine || isDeleted) bar.push({ key: "delete", icon: "trash-2", label: "Delete", onPress: run(props.onDeletePress), color: colors.danger });

  const more: { key: string; icon: IconName; label: string; onPress: () => void; fill?: boolean }[] = [{ key: "select", icon: "check-square", label: "Select", onPress: run(props.onSelect) }];
  if (!isDeleted) {
    more.push({ key: "pin", icon: "pin", label: isPinned ? "Unpin" : "Pin", onPress: run(props.onTogglePin), fill: isPinned });
    more.push({ key: "hide", icon: "eye-off", label: "Hide for me", onPress: run(props.onHide) });
    more.push({ key: "share", icon: "share-2", label: "Share outside app", onPress: run(props.onShare) });
  }

  return (
    <Modal transparent animationType="fade" statusBarTranslucent visible onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill} onLayout={e => setScreen(e.nativeEvent.layout)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => (moreOpen ? setMoreOpen(false) : onClose())} accessibilityLabel="Close message actions" />

        <View style={[s.bar, { paddingTop: insets.top, height: barBottom, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} style={s.barButton} accessibilityLabel="Close"><Icon name="x" size={21} color={colors.textMuted} /></Pressable>
          <View style={s.flex} />
          {bar.map(item => (
            <Pressable key={item.key} onPress={item.onPress} style={s.barButton} accessibilityLabel={item.label}>
              <Icon name={item.icon} size={20} color={item.color ?? colors.text} fill={item.fill ? item.color ?? colors.accent : "none"} />
            </Pressable>
          ))}
          <Pressable onPress={() => setMoreOpen(value => !value)} style={s.barButton} accessibilityLabel="More options"><Icon name="more-horizontal" size={20} color={colors.text} /></Pressable>
        </View>

        {moreOpen && (
          <View style={[s.more, { top: barBottom + 4, backgroundColor: colors.surface, borderColor: colors.border }]}>
            {more.map(item => (
              <Pressable key={item.key} onPress={item.onPress} style={s.moreItem}>
                <Icon name={item.icon} size={18} color={colors.text} fill={item.fill ? colors.accent : "none"} />
                <Text style={s.moreText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {!isDeleted && (
          <View style={[s.pill, { top: pillTop, left: pillLeft, width: pillWidth || undefined, opacity: pillWidth ? 1 : 0, backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ScrollView horizontal onContentSizeChange={width => setContentWidth(width)} showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow} keyboardShouldPersistTaps="handled">
              {emojis.map(emoji => (
                <Pressable key={emoji} onPress={() => { if (myReaction === emoji) props.onRemoveReaction(); else props.onReact(emoji); onClose(); }} style={[s.emoji, myReaction === emoji && { borderWidth: 2, borderColor: colors.accent }]}>
                  <Text style={s.emojiText}>{emoji}</Text>
                </Pressable>
              ))}
              <Pressable onPress={run(props.onOpenFullPicker)} style={[s.emojiMore, { borderColor: colors.border }]} accessibilityLabel="More emoji"><Icon name="plus" size={16} color={colors.textMuted} /></Pressable>
            </ScrollView>
          </View>
        )}

        <View pointerEvents="none" style={[s.highlight, { top: anchor.y - 6, left: anchor.x - 6, width: anchor.width + 12, height: anchor.height + 12, backgroundColor: colors.accentSoft }]} />
        <View pointerEvents="none" style={[s.frozen, { top: anchor.y, left: anchor.x, width: anchor.width, maxHeight: Math.max(120, screen.height - anchor.y - insets.bottom - 8) }, isMine ? { backgroundColor: colors.accent } : { backgroundColor: "#181A18", borderWidth: StyleSheet.hairlineWidth, borderColor: "#292C29" }]}>
          <Text style={[s.frozenText, isMine && { color: "#07130D" }, isDeleted && { fontStyle: "italic", opacity: 0.7 }]} numberOfLines={12}>{isDeleted ? "This message was deleted" : content}</Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  bar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 3 },
  barButton: { width: 42, height: 46, alignItems: "center", justifyContent: "center" },
  more: { position: "absolute", right: 8, width: 210, borderWidth: 1, borderRadius: 12, paddingVertical: 4, zIndex: 4, elevation: 10, shadowColor: "#000", shadowOpacity: 0.32, shadowRadius: 10 },
  moreItem: { minHeight: 46, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  moreText: { fontSize: 14, fontWeight: "600" },
  pill: { position: "absolute", borderWidth: 1, borderRadius: 30, zIndex: 2, elevation: 8, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10 },
  pillRow: { alignItems: "center", gap: 4, paddingHorizontal: 8, height: PILL_HEIGHT },
  emoji: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  emojiText: { fontSize: 28, lineHeight: 34 },
  emojiMore: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", marginLeft: 2 },
  highlight: { position: "absolute", borderRadius: 14, opacity: 0.7 },
  frozen: { position: "absolute", borderRadius: 16, paddingHorizontal: 11, paddingVertical: 8, overflow: "hidden" },
  frozenText: { fontSize: 15, lineHeight: 20 },
});

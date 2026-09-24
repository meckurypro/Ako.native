// File: components/messaging/EmojiPickerSheet.tsx
// Full emoji picker opened from the "+" on the quick-react strip; picking one sets the
// reaction. Uses the same categories as the composer's emoji tray.
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/core/Icon";
import { Text } from "@/components/core";
import { EMOJI_CATEGORIES } from "@/features/messaging/emoji";
import { useTheme } from "@/providers/ThemeProvider";

type Props = { onPick: (emoji: string) => void; onClose: () => void };

export function EmojiPickerSheet({ onPick, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" statusBarTranslucent visible onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)" }]} onPress={onClose} />
      <View style={s.end} pointerEvents="box-none">
        <View style={[s.sheet, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom }]}>
          <View style={s.head}><Text style={s.title}>React with</Text><Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={21} color={colors.textMuted} /></Pressable></View>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {EMOJI_CATEGORIES.map(section => (
              <View key={section.key} style={s.section}>
                <Text color="muted" style={s.label}>{section.label}</Text>
                <View style={s.grid}>
                  {section.emojis.map((emoji, index) => <Pressable key={`${section.key}-${index}`} onPress={() => onPick(emoji)} style={s.cell}><Text style={s.emoji}>{emoji}</Text></Pressable>)}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  end: { flex: 1, justifyContent: "flex-end" },
  sheet: { height: "55%", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  title: { fontSize: 14, fontWeight: "700" },
  scroll: { paddingHorizontal: 12, paddingBottom: 18 },
  section: { marginBottom: 12 },
  label: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "12.5%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 27, lineHeight: 32 },
});

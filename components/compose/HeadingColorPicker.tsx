import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/core/Icon";
import { useTheme } from "@/providers/ThemeProvider";
import { HEADING_COLORS, getHeadingColorDef } from "@/lib/heading-colors";

/**
 * The small swatch button next to Compose's heading input, plus the
 * popover it opens — native port of web's HeadingColorPicker.tsx. The
 * button always shows the current pick (or a dashed ring when unset)
 * rather than a generic palette icon.
 */
export function HeadingColorPicker({ value, onChange, isDark }: { value: string | null; onChange: (key: string | null) => void; isDark: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const currentDef = getHeadingColorDef(value);

  return <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={currentDef ? `Heading color: ${currentDef.label}` : "Heading color"}
      onPress={() => setOpen(true)}
      style={[styles.button, currentDef ? { backgroundColor: isDark ? currentDef.dark : currentDef.light } : { borderWidth: 2, borderStyle: "dashed", borderColor: colors.textMuted }]}
    />
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.modal}>
        <Pressable onPress={() => setOpen(false)} style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.grid}>
            <Pressable accessibilityLabel="Default heading color" onPress={() => { onChange(null); setOpen(false); }} style={[styles.swatch, { borderWidth: 2, borderStyle: "dashed", borderColor: colors.textMuted }]}>
              {value === null ? <Icon name="check" size={16} color={colors.textMuted} /> : null}
            </Pressable>
            {HEADING_COLORS.map((c) => <Pressable key={c.key} accessibilityLabel={c.label} onPress={() => { onChange(c.key); setOpen(false); }} style={[styles.swatch, { backgroundColor: isDark ? c.dark : c.light }]}>
              {value === c.key ? <View style={styles.checkBadge}><Icon name="check" size={11} color="#262626" /></View> : null}
            </Pressable>)}
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  button: { width: 24, height: 24, borderRadius: 12 },
  modal: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 16, maxWidth: "88%" },
  grid: { flexDirection: "row", flexWrap: "wrap", width: 4 * 44, gap: 8 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  checkBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(255,255,255,.95)", alignItems: "center", justifyContent: "center" },
});

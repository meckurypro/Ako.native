// File: components/BottomSheet.tsx
//
// Shared chrome for bottom action sheets. Web hand-rolls this in every
// sheet (PostActionSheet, ConversationActionSheet, ...): a dim backdrop
// (bg-canvas/70) and a bg-surface rounded-t-2xl border-t panel, max-w-xl,
// padded for the bottom safe area. Unlike Modal/DropdownMenu these follow
// the normal theme tokens, not the fixed dark overlay palette. No slide
// animation beyond the fade — web's sheets don't animate either.
//
// Built on RN's <Modal>, same as components/Modal.tsx and DropdownMenu.tsx
// (so it sits above BottomNav, and Android back = onRequestClose), and it
// uses the SAME "close first, then run the action" sequencing as
// DropdownMenu: an action that opens a <ConfirmDialog> (Delete post,
// Delete chat) would otherwise present a second iOS <Modal> while this one
// is still dismissing, and iOS drops it. Rows therefore don't call
// `onClose()` themselves — they call the sheet's `select(action)`, which
// fades the sheet out and runs `action` after the dismissal finishes.
// Caller renders it conditionally: `{open && <BottomSheet ... />}`.
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal as RNModal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, withAlpha } from "../lib/theme";

interface SheetContextValue {
  /** Fade the sheet out, then close it and run `action` (if any). */
  select: (action?: () => void) => void;
  /** Close with nothing to run afterwards (Cancel, backdrop tap). */
  dismiss: () => void;
}

const SheetContext = createContext<SheetContextValue | null>(null);

function useSheet(): SheetContextValue {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error("SheetRow / SheetCancel must be rendered inside <BottomSheet>");
  return ctx;
}

interface BottomSheetProps {
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
}

export function BottomSheet({ onClose, children, ariaLabel }: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(true);
  const pendingAction = useRef<(() => void) | null>(null);
  const finished = useRef(false);

  // Runs once: closes, then fires the chosen action. Guarded so the two
  // paths that can reach it (iOS onDismiss / Android timeout) can't both.
  function finish() {
    if (finished.current) return;
    finished.current = true;
    const run = pendingAction.current;
    pendingAction.current = null;
    onClose();
    run?.();
  }

  function dismiss() {
    if (finished.current) return;
    finished.current = true;
    onClose();
  }

  function select(action?: () => void) {
    if (finished.current) return;
    pendingAction.current = action ?? null;
    setVisible(false); // fade out first…
    if (Platform.OS !== "ios") setTimeout(finish, 0); // …iOS finishes from onDismiss
  }

  return (
    <SheetContext.Provider value={{ select, dismiss }}>
      <RNModal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismiss}
        onDismiss={finish} // iOS only
      >
        <View style={styles.root}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(colors.canvas, 0.7) }]}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View
            accessibilityViewIsModal
            accessibilityLabel={ariaLabel}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                paddingBottom: insets.bottom,
              },
            ]}
          >
            {children}
          </View>
        </View>
      </RNModal>
    </SheetContext.Provider>
  );
}

interface SheetRowProps {
  icon?: LucideIcon;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

/** One tappable row: px-4 py-3.5, gap-3, text-sm, 18px icon. Runs
 *  `onPress` after the sheet has finished closing. */
export function SheetRow({ icon: Icon, label, onPress, danger = false }: SheetRowProps) {
  const { colors } = useTheme();
  const { select } = useSheet();
  const color = danger ? colors.danger : colors.ink;

  return (
    <Pressable
      onPress={() => select(onPress)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.accentSoft }]}
    >
      {Icon && <Icon size={18} color={color} />}
      <Text style={[styles.rowText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** Centered muted "Cancel" with a top border (border-t mt-1). */
export function SheetCancel({ label = "Cancel" }: { label?: string }) {
  const { colors } = useTheme();
  const { dismiss } = useSheet();

  return (
    <Pressable
      onPress={dismiss}
      accessibilityRole="button"
      style={[styles.cancel, { borderTopColor: colors.border }]}
    >
      <Text style={[styles.rowText, { color: colors.inkMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // fixed inset-0 flex items-end justify-center
  root: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  // w-full max-w-xl bg-surface rounded-t-2xl border-t
  sheet: {
    width: "100%",
    maxWidth: 576,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowText: { fontSize: 14 },
  // w-full py-3.5 text-sm text-ink-muted border-t mt-1
  cancel: { paddingVertical: 14, alignItems: "center", borderTopWidth: 1, marginTop: 4 },
});

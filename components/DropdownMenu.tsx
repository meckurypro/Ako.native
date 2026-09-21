// File: components/DropdownMenu.tsx
//
// Port of web's src/components/DropdownMenu.tsx — the shared three-dot / kebab
// menu panel, anchored under (or, when there's no room below, above) its
// trigger, right-aligned to it, on the same dark-glass overlay panel as Modal.
//
// Caller renders it conditionally — `{open && <DropdownMenu … />}` — exactly
// as on web, and passes a ref to the trigger:
//   const menuAnchor = useRef<View>(null);
//   <Pressable ref={menuAnchor} onPress={() => setOpen(true)}>…</Pressable>
//   {open && <DropdownMenu anchorRef={menuAnchor} items={…} onClose={() => setOpen(false)} />}
//
// Native differences:
//   - Positioning: getBoundingClientRect → anchor.measureInWindow(). Web also
//     subtracts BottomNav's height (#ako-bottom-nav) from the viewport; here
//     the menu is an RN <Modal> that sits ABOVE BottomNav, so the room below
//     the trigger is simply the window height minus the bottom safe-area inset.
//     (Coordinates assume the app is edge-to-edge / status bar translucent, as
//     Expo SDK 54+ apps are.)
//   - Portal, useScrollLock, the document mousedown listener, useBackDismiss →
//     gone / onRequestClose, same reasons as Modal.tsx.
//   - runAfterDismiss: web waits for the menu's popstate before running
//     onSelect. Same intent here, and it matters more: an item that opens a
//     <ConfirmDialog> would otherwise present a second iOS <Modal> while this
//     one is still dismissing, and iOS drops it. So on iOS onSelect runs from
//     the <Modal>'s onDismiss (after the fade-out finishes); on Android, where
//     stacked dialogs are fine, it runs on the next tick.
//   - `icon` may be a plain node (as on web) or a function receiving the row's
//     text color and the 24dp slot size — native has no `currentColor`, so this
//     is how an icon picks up the danger tint:
//       icon: ({ color, size }) => <Trash2 size={size} color={color} />
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { overlayColors } from "../lib/theme";

export interface DropdownMenuItem {
  key: string;
  label: string;
  icon?: ReactNode | ((props: { color: string; size: number }) => ReactNode);
  onSelect: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  /** e.g. an unread-count pill, rendered flush right */
  badge?: ReactNode;
}

interface DropdownMenuProps {
  anchorRef: RefObject<View | null>;
  items: (DropdownMenuItem | "divider")[];
  onClose: () => void;
  /** Panel width in dp. Default 224 = Tailwind w-56. */
  width?: number;
}

const ROW_HEIGHT = 52; // ~13 x 4 — matches WhatsApp's roomy row scale
const VIEWPORT_MARGIN = 8;
const ICON_SIZE = 24;

interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function DropdownMenu({ anchorRef, items, onClose, width = 224 }: DropdownMenuProps) {
  const { width: windowW, height: windowH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [visible, setVisible] = useState(true);
  const pendingSelect = useRef<(() => void) | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    anchorRef.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, width: w, height: h }));
  }, [anchorRef]);

  // Closes the menu, then runs whichever item was chosen (if any). Guarded so
  // the two paths that can reach it (iOS onDismiss / Android timeout) can't
  // both fire it.
  function finish() {
    if (finished.current) return;
    finished.current = true;
    const run = pendingSelect.current;
    pendingSelect.current = null;
    onClose();
    run?.();
  }

  // Backdrop tap / Android back: nothing to run afterwards, just close.
  function dismiss() {
    if (finished.current) return;
    finished.current = true;
    onClose();
  }

  function select(item: DropdownMenuItem) {
    if (item.disabled || finished.current) return;
    pendingSelect.current = item.onSelect;
    setVisible(false); // fade out first…
    if (Platform.OS !== "ios") setTimeout(finish, 0); // …iOS finishes from onDismiss
  }

  // Same sizing/flip logic as web.
  let panelStyle: { top?: number; bottom?: number; right: number; maxHeight: number } | null = null;
  if (anchor) {
    const viewportH = windowH - insets.bottom;
    const rowCount = items.filter((i) => i !== "divider").length;
    const desired = Math.min(rowCount * ROW_HEIGHT + 16, 420);
    const spaceBelow = viewportH - (anchor.y + anchor.height) - VIEWPORT_MARGIN;
    const spaceAbove = anchor.y - VIEWPORT_MARGIN;
    const openUp = spaceBelow < Math.min(desired, 180) && spaceAbove > spaceBelow;

    panelStyle = {
      ...(openUp ? { bottom: windowH - anchor.y + 4 } : { top: anchor.y + anchor.height + 4 }),
      right: Math.max(VIEWPORT_MARGIN, windowW - (anchor.x + anchor.width)),
      maxHeight: Math.max(160, Math.min(desired, openUp ? spaceAbove : spaceBelow)),
    };
  }

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
      onDismiss={finish} // iOS only
    >
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
      />
      {/* Hidden until the anchor has been measured (web: opacity 0). */}
      <View style={[styles.panel, { width }, panelStyle ?? styles.unmeasured]}>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          {items.map((item, i) => {
            if (item === "divider") return <View key={`divider-${i}`} style={styles.divider} />;

            const color = item.variant === "danger" ? overlayColors.danger : overlayColors.ink;
            return (
              <Pressable
                key={item.key}
                onPress={() => select(item)}
                disabled={item.disabled}
                accessibilityRole="menuitem"
                accessibilityState={{ disabled: !!item.disabled }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                  item.disabled && styles.rowDisabled,
                ]}
              >
                {/* Fixed-size slot for every row, icon or not, so labels line up. */}
                <View style={styles.iconSlot}>
                  {typeof item.icon === "function" ? item.icon({ color, size: ICON_SIZE }) : item.icon}
                </View>
                <Text style={[styles.label, { color }]}>{item.label}</Text>
                {item.badge}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0,0,0,0.4)" },
  // .ako-overlay-panel + rounded-2xl py-2
  panel: {
    position: "absolute",
    backgroundColor: "rgba(28, 28, 30, 0.96)",
    borderWidth: 1,
    borderColor: overlayColors.border,
    borderRadius: 16,
    paddingVertical: 8,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
  unmeasured: { top: 0, right: 0, opacity: 0 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: overlayColors.border, marginVertical: 8 },
  // gap-4 px-5 py-3.5, text-base leading-snug
  row: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingVertical: 14 },
  rowPressed: { backgroundColor: overlayColors.surfaceRaised },
  rowDisabled: { opacity: 0.4 },
  iconSlot: { width: ICON_SIZE, height: ICON_SIZE, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontSize: 16, lineHeight: 22 },
});

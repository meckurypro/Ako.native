// File: components/Modal.tsx
//
// Port of web's src/components/Modal.tsx — the one shared wrapper every
// centered dialog goes through (ConfirmDialog, and later AddAccountModal,
// ArchivedPostModal, PageInviteResponseModal): dimmed backdrop, tap-outside
// to close, and the fixed dark-glass card (web's .ako-overlay-panel) with
// light text regardless of the app theme.
//
// Native differences — most of web's file exists to work around browser
// layout, and all of that is simply gone:
//   - <Portal>: RN's <Modal> already renders at the root, above everything
//     (including BottomNav and any SwipeableTabs pane), so the translateX
//     containing-block bug web's Portal fixes can't happen.
//   - useBackDismiss (history popstate) → onRequestClose, which is the Android
//     hardware/gesture back button (and iOS accessibility escape).
//   - useScrollLock, the Escape-key listener → not needed; a native <Modal>
//     blocks the screen behind it.
//   - zIndexClass → gone; there's no z-index. NOTE the flip side: on iOS a
//     <Modal> must be rendered INSIDE another open <Modal>'s tree (not as a
//     sibling) to stack on top of it — the way web's ArchivedPostModal needed
//     its `z-40` override, the equivalent here is nesting.
//   - maxWidthClass → `maxWidth` in dp (default 384 = Tailwind max-w-sm).
//   - backdrop-blur: web's is 1.2px, effectively invisible; omitted.
import { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { overlayColors } from "../lib/theme";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  role?: "dialog" | "alertdialog";
  ariaLabel?: string;
  /** Card max width in dp. Default matches every existing centered dialog. */
  maxWidth?: number;
  /** Skip the default dark-glass card/padding and just provide the centered,
   *  scrollable positioning box — for content that brings its own card chrome
   *  (e.g. a real PostCard). */
  bare?: boolean;
}

export function Modal({
  onClose,
  children,
  role = "dialog",
  ariaLabel,
  maxWidth = 384,
  bare = false,
}: ModalProps) {
  const { height } = useWindowDimensions();

  return (
    <RNModal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.center}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* bg-black/40 — tapping outside the card closes */}
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          accessibilityViewIsModal
          accessibilityRole={role === "alertdialog" ? "alert" : undefined}
          accessibilityLabel={ariaLabel}
          style={[styles.card, { maxWidth }, bare ? null : styles.shadow]}
        >
          <ScrollView
            style={[bare ? null : styles.panel, { maxHeight: height * 0.85 }]} // max-h-[85vh]
            contentContainerStyle={bare ? undefined : styles.panelContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }, // px-6
  backdrop: { backgroundColor: "rgba(0,0,0,0.4)" },
  card: { width: "100%" },
  // .ako-overlay-panel: rgba(overlay-surface, .96) + 1px overlay border,
  // rounded-[28px], p-6. The layered shadow sits on the outer <View> because
  // iOS clips a shadow on a view that also has overflow: hidden.
  shadow: {
    borderRadius: 28,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
  panel: {
    backgroundColor: "rgba(28, 28, 30, 0.96)", // overlayColors.surface @ 96%
    borderWidth: 1,
    borderColor: overlayColors.border,
    borderRadius: 28,
    overflow: "hidden",
  },
  panelContent: { padding: 24 },
});

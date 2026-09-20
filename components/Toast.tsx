// File: components/Toast.tsx
//
// Port of web's global toast: `toast("message", { variant })` from
// anywhere, bottom-anchored, stacked, auto-dismissing after 2000ms, rise +
// fade in (180ms). Mount <ToastProvider> once at the root, AFTER the app
// content so it renders on top of the Bottom Nav.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, Info, XCircle } from "lucide-react-native";
import { useTheme } from "../lib/theme";

type ToastVariant = "default" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastOptions {
  variant?: ToastVariant;
  /** ms before auto-dismiss. 2000 everywhere — not meant to be overridden. */
  duration?: number;
}

type ToastFn = (message: string, options?: ToastOptions) => void;

const ToastContext = createContext<ToastFn | null>(null);

const DEFAULT_DURATION_MS = 2000;

function ToastView({ item }: { item: ToastItem }) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  // @keyframes toast-in: opacity 0→1, translateY 6px→0, 180ms ease-out
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 180,
      easing: Easing.bezier(0, 0, 0.58, 1),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const iconColor =
    item.variant === "success" ? colors.accent : item.variant === "error" ? colors.danger : colors.inkMuted;
  const Icon = item.variant === "success" ? CheckCircle2 : item.variant === "error" ? XCircle : Info;

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          backgroundColor: colors.ink,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
        },
      ]}
    >
      <Icon size={18} color={iconColor} />
      <Text style={[styles.text, { color: colors.canvas }]}>{item.message}</Text>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback<ToastFn>((message, options) => {
    const id = nextId.current++;
    const variant = options?.variant ?? "default";
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, options?.duration ?? DEFAULT_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* fixed bottom-0 inset-x-0 pb-24 px-4, stacked gap-2, click-through */}
      <View pointerEvents="box-none" style={styles.layer}>
        {toasts.map((t) => (
          <ToastView key={t.id} item={t} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

/** Fire a toast from anywhere: `const toast = useToast(); toast("Saved.")`. */
export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 70,
    elevation: 70,
    paddingBottom: 96,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
  },
  // max-w-sm w-full flex items-start gap-2.5 rounded-2xl px-4 py-3 shadow-lg
  toast: {
    width: "100%",
    maxWidth: 384,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  // text-sm leading-snug
  text: { flex: 1, fontSize: 14, lineHeight: 19 },
});

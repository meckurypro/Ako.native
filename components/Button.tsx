// File: components/Button.tsx
import { Pressable, Text, StyleSheet, type PressableProps } from "react-native";
import { useTheme } from "../lib/theme";

interface ButtonProps extends PressableProps {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  // "md" (default) — full-width button used throughout the app.
  // "sm" — compact pill variant for inline row actions. Mirrors web's
  // Button.tsx size prop exactly.
  size?: "md" | "sm";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  loading = false,
  size = "md",
  disabled,
  children,
  style,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const backgroundByVariant = {
    primary: colors.accent,
    secondary: colors.accentSoft,
    ghost: "transparent",
  } as const;

  const textColorByVariant = {
    primary: colors.canvas,
    secondary: colors.accent,
    ghost: colors.inkMuted,
  } as const;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === "sm" ? styles.sizeSm : styles.sizeMd,
        { backgroundColor: backgroundByVariant[variant] },
        isDisabled ? styles.disabled : null,
        // RN's stand-in for :hover, since touch has no hover state.
        pressed && !isDisabled ? styles.pressed : null,
        typeof style === "function" ? style({ pressed }) : style,
      ]}
      {...rest}
    >
      <Text
        style={[
          styles.text,
          size === "sm" ? styles.textSm : null,
          { color: textColorByVariant[variant] },
        ]}
      >
        {loading ? (size === "sm" ? "…" : "Please wait…") : children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  sizeMd: { width: "100%", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  sizeSm: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 999 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  text: { fontWeight: "500", fontSize: 16 },
  textSm: { fontSize: 14 },
});

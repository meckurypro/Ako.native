// File: components/Button.tsx
import { Pressable, Text, StyleSheet, type PressableProps } from "react-native";

interface ButtonProps extends PressableProps {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
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
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === "sm" ? styles.sizeSm : styles.sizeMd,
        variants[variant],
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null, // RN's stand-in for :hover, since touch has no hover state
        typeof style === "function" ? style({ pressed }) : style,
      ]}
      {...rest}
    >
      <Text style={[styles.text, variant === "primary" ? styles.textPrimary : styles.textOther]}>
        {loading ? (size === "sm" ? "…" : "Please wait…") : children}
      </Text>
    </Pressable>
  );
}

const variants = StyleSheet.create({
  primary: { backgroundColor: "#111827" }, // accent — swap for your theme token
  secondary: { backgroundColor: "#F3F4F6" }, // accent-soft
  ghost: { backgroundColor: "transparent" },
});

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  sizeMd: { width: "100%", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  sizeSm: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 999 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  text: { fontWeight: "500", fontSize: 16 },
  textPrimary: { color: "#FFFFFF" }, // canvas
  textOther: { color: "#111827" },
});

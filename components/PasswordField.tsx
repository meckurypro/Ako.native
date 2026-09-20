// File: components/PasswordField.tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, type TextInputProps } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { useTheme, withAlpha } from "../lib/theme";

interface PasswordFieldProps extends Omit<TextInputProps, "secureTextEntry"> {
  label: string;
  error?: string;
}

// Same focus/border behavior as FormField — see the comment there.
export function PasswordField({
  label,
  error,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: PasswordFieldProps) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : focused
    ? colors.accent
    : withAlpha(colors.inkMuted, 0.2);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.inkMuted }]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          {...inputProps}
          secureTextEntry={!visible}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: colors.ink, borderColor }, style]}
          placeholderTextColor={withAlpha(colors.inkMuted, 0.45)}
        />
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityLabel={visible ? "Hide password" : "Show password"}
          hitSlop={8}
          style={styles.eyeButton}
        >
          {visible ? (
            <EyeOff size={17} color={colors.inkMuted} />
          ) : (
            <Eye size={17} color={colors.inkMuted} />
          )}
        </Pressable>
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  label: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  inputRow: { position: "relative", justifyContent: "center" },
  input: {
    width: "100%",
    paddingBottom: 12,
    paddingTop: 4,
    paddingRight: 32,
    fontSize: 16,
    borderBottomWidth: 2,
  },
  eyeButton: { position: "absolute", right: 0, bottom: 10 },
  error: { fontSize: 13, marginTop: 8 },
});

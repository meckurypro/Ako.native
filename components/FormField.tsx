// File: components/FormField.tsx
import { useState } from "react";
import { View, Text, TextInput, StyleSheet, type TextInputProps } from "react-native";
import { useTheme, withAlpha } from "../lib/theme";

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

// Web version used a native <label htmlFor>; RN has no id-based
// label/input linking, so the Text above the input is purely visual —
// screen readers rely on the input's own accessibilityLabel instead.
//
// Web's border color is border-ink-muted/20 → hover:/40 → focus:accent.
// RN has no hover, so this tracks focus state directly to get the
// focus:border-accent behavior; unfocused stays at the /20 resting color.
export function FormField({ label, error, style, onFocus, onBlur, ...inputProps }: FormFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : focused
    ? colors.accent
    : withAlpha(colors.inkMuted, 0.2);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.inkMuted }]}>{label}</Text>
      <TextInput
        {...inputProps}
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
  input: {
    width: "100%",
    paddingBottom: 12,
    paddingTop: 4,
    fontSize: 16,
    borderBottomWidth: 2,
  },
  error: {
    fontSize: 13,
    marginTop: 8,
  },
});

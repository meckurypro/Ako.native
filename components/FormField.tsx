// File: components/FormField.tsx
import { View, Text, TextInput, StyleSheet, type TextInputProps } from "react-native";

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

// Web version used a native <label htmlFor>; RN has no id-based
// label/input linking, so the Text above the input is purely visual —
// screen readers rely on the input's own accessibilityLabel instead.
export function FormField({ label, error, style, ...inputProps }: FormFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor="#9CA3AF" // matches ink-muted/45 intent — replace with your theme token
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
    color: "#6B7280", // ink-muted — swap for your theme color
    marginBottom: 10,
  },
  input: {
    width: "100%",
    paddingBottom: 12,
    paddingTop: 4,
    fontSize: 16,
    color: "#111827", // ink
    borderBottomWidth: 2,
    borderColor: "rgba(107,114,128,0.2)", // ink-muted/20
  },
  inputError: {
    borderColor: "#DC2626", // danger
  },
  error: {
    color: "#DC2626",
    fontSize: 13,
    marginTop: 8,
  },
});

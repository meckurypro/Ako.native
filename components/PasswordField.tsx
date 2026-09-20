// File: components/PasswordField.tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, type TextInputProps } from "react-native";
import { Eye, EyeOff } from "lucide-react-native"; // FLAG: web used lucide-react — this is the RN sibling package, confirm it's installed

interface PasswordFieldProps extends Omit<TextInputProps, "secureTextEntry"> {
  label: string;
  error?: string;
}

export function PasswordField({ label, error, style, ...inputProps }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          {...inputProps}
          secureTextEntry={!visible}
          accessibilityLabel={label}
          style={[styles.input, error ? styles.inputError : null, style]}
          placeholderTextColor="#9CA3AF"
        />
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityLabel={visible ? "Hide password" : "Show password"}
          style={styles.eyeButton}
        >
          {visible ? <EyeOff size={17} color="#6B7280" /> : <Eye size={17} color="#6B7280" />}
        </Pressable>
      </View>
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
    color: "#6B7280",
    marginBottom: 10,
  },
  inputRow: { position: "relative", justifyContent: "center" },
  input: {
    width: "100%",
    paddingBottom: 12,
    paddingTop: 4,
    paddingRight: 32,
    fontSize: 16,
    color: "#111827",
    borderBottomWidth: 2,
    borderColor: "rgba(107,114,128,0.2)",
  },
  inputError: { borderColor: "#DC2626" },
  eyeButton: { position: "absolute", right: 0, bottom: 10 },
  error: { color: "#DC2626", fontSize: 13, marginTop: 8 },
});

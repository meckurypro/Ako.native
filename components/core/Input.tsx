import { forwardRef, useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

type Props = TextInputProps & { label: string; error?: string | null; hint?: string };
export const Input = forwardRef<TextInput, Props>(function Input({ label, error, hint, secureTextEntry, style, ...props }, ref) {
  const { colors, radii, typography } = useTheme(); const [focused, setFocused] = useState(false); const [revealed, setRevealed] = useState(false);
  return <View style={{ gap: 7 }}><Text variant="label">{label}</Text><View style={{ minHeight: 50, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: error ? colors.danger : focused ? colors.accent : colors.border, borderRadius: radii.md, backgroundColor: colors.surface, paddingLeft: 14 }}><TextInput ref={ref} {...props} secureTextEntry={secureTextEntry && !revealed} placeholderTextColor={colors.textMuted} selectionColor={colors.accent} onFocus={(event) => { setFocused(true); props.onFocus?.(event); }} onBlur={(event) => { setFocused(false); props.onBlur?.(event); }} style={[typography.body, { color: colors.text, flex: 1, paddingVertical: 12 }, style]} />{secureTextEntry && <IconButton icon={revealed ? "eye-off" : "eye"} label={revealed ? "Hide password" : "Show password"} onPress={() => setRevealed((value) => !value)} />}</View>{error ? <Text variant="caption" color="danger" accessibilityRole="alert">{error}</Text> : hint ? <Text variant="caption" color="muted">{hint}</Text> : null}</View>;
});

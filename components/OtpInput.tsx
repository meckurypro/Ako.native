// File: components/OtpInput.tsx
//
// 8-digit OTP entry — matches Supabase's email OTP length for this
// project (Dashboard > Auth > Emails). If that setting differs from 8,
// update the `length` default or verifyOtp will always receive an
// incomplete code.
//
// Native differences: web's onPaste becomes "a change longer than one
// digit that reaches `length`" — that's what a paste or the iOS/Android
// one-time-code autofill delivers into a single box, and it fills every
// box. Backspace-on-empty-box focus-back uses onKeyPress; some Android
// soft keyboards don't emit it for an empty field, so there the user
// taps the previous box.
import { useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from "react-native";
import { useTheme, withAlpha } from "../lib/theme";

interface OtpInputProps {
  length?: number;
  onComplete: (code: string) => void;
  error?: string;
}

export function OtpInput({ length = 8, onComplete, error }: OtpInputProps) {
  const { colors } = useTheme();
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const [focused, setFocused] = useState<number | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  function handleChange(index: number, value: string) {
    const cleaned = value.replace(/[^0-9]/g, "");

    // Paste / autofill: a full code landed in one box.
    if (cleaned.length >= length) {
      const code = cleaned.slice(0, length);
      setDigits(code.split(""));
      inputRefs.current[length - 1]?.focus();
      onComplete(code);
      return;
    }

    // Typing: keep only the last digit (the box may already hold one).
    const digit = cleaned.slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (next.every((d) => d !== "")) {
      onComplete(next.join(""));
    }
  }

  function handleKeyPress(index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <View>
      <View style={styles.row}>
        {digits.map((digit, i) => {
          const isFocused = focused === i;
          return (
            // focus:ring-2 focus:ring-accent/40 — drawn as a 2px outer
            // border with negative margin so layout matches web.
            <View
              key={i}
              style={[
                styles.ring,
                { borderColor: isFocused ? withAlpha(colors.accent, 0.4) : "transparent" },
              ]}
            >
              <TextInput
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                value={digit}
                onChangeText={(v) => handleChange(i, v)}
                onKeyPress={(e) => handleKeyPress(i, e)}
                onFocus={() => setFocused(i)}
                onBlur={() => setFocused((f) => (f === i ? null : f))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                selectTextOnFocus
                accessibilityLabel={`Digit ${i + 1} of ${length}`}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.canvas,
                    color: colors.ink,
                    borderColor: isFocused ? colors.accent : error ? colors.danger : colors.border,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // flex gap-2 justify-center
  row: { flexDirection: "row", gap: 8, justifyContent: "center" },
  ring: { margin: -2, borderWidth: 2, borderRadius: 10 },
  // w-10 h-12 text-center text-lg font-medium rounded-lg border
  input: {
    width: 40,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "500",
    padding: 0,
  },
  // text-sm mt-3 text-center
  error: { fontSize: 14, marginTop: 12, textAlign: "center" },
});

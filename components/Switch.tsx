// File: components/Switch.tsx
//
// The app's switch visual, shared. Web hand-builds this in Settings.tsx
// (ToggleRow) and PrivacyToggle.tsx: w-11 h-6 track, accent when on /
// border color when off, 20px canvas knob that slides 20px. Not RN's
// native <Switch> on purpose — that would look different per platform.
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../lib/theme";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function Switch({ checked, onChange, disabled = false, accessibilityLabel }: SwitchProps) {
  const { colors } = useTheme();
  const progress = useRef(new Animated.Value(checked ? 1 : 0)).current;

  // transition-colors / transition-[left]: Tailwind's default 150ms
  useEffect(() => {
    Animated.timing(progress, {
      toValue: checked ? 1 : 0,
      duration: 150,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false, // backgroundColor can't use the native driver
    }).start();
  }, [checked, progress]);

  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled }}
      hitSlop={8}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.border, colors.accent],
            }),
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.knob,
            {
              backgroundColor: colors.canvas,
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [2, 22] }) },
              ],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // w-11 h-6 rounded-full
  track: { width: 44, height: 24, borderRadius: 12, overflow: "hidden" },
  // absolute top-0.5 w-5 h-5 rounded-full
  knob: { position: "absolute", top: 2, left: 0, width: 20, height: 20, borderRadius: 10 },
});

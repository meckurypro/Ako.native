// File: components/security/BiometricLockScreen.tsx
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { Button, Screen, Text } from "@/components/core";
import { Icon } from "@/components/core/Icon";
import { authenticate, type BiometricLabel } from "@/features/security/biometric";
import { useTheme } from "@/providers/ThemeProvider";

// Rendered as a full-screen overlay over the whole app (see BiometricLockGate)
// while locked — nothing behind it, including navigation state, is visible
// or interactive until unlock() reports success. Prompts automatically on
// mount so re-opening the app after backgrounding goes straight to the
// Face ID/fingerprint sheet instead of making the person tap a button first;
// the button is there for a cancelled/failed first attempt to retry from.
export function BiometricLockScreen({ label, onUnlock }: { label: BiometricLabel; onUnlock: () => void }) {
  const { colors } = useTheme();
  const attempted = useRef(false);
  const tryUnlock = async () => {
    if (await authenticate(`Unlock Akọ with ${label}`)) onUnlock();
  };
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount only; tryUnlock is intentionally re-created each render but the initial prompt should fire exactly once
  }, []);
  return (
    <View style={{ position: "absolute", inset: 0, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <Screen scroll={false} contentStyle={{ justifyContent: "center", alignItems: "center" }}>
        <View style={{ maxWidth: 320, alignItems: "center", gap: 16 }}>
          <Icon name="scan-face" size={48} color={colors.accent} />
          <Text variant="heading">Akọ is locked</Text>
          <Text color="secondary" align="center">Use {label} to keep going.</Text>
          <Button label={`Unlock with ${label}`} onPress={() => void tryUnlock()} />
        </View>
      </Screen>
    </View>
  );
}

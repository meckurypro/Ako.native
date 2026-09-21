// File: components/account/AccountAccessError.tsx
import { View } from "react-native";
import { Button, Screen, Text } from "@/components/core";

// Shown when the account-access check itself fails (network/DB). The gate fails closed, so the app stays locked until it succeeds (mirrors web's RequireAuth error state).
export function AccountAccessError({ onRetry, retrying }: { onRetry: () => void; retrying?: boolean }) {
  return (
    <Screen scroll={false} contentStyle={{ justifyContent: "center", alignItems: "center" }}>
      <View style={{ maxWidth: 320, alignItems: "center", gap: 12 }}>
        <Text color="secondary" align="center">We couldn’t confirm your account access. Check your connection and try again.</Text>
        <Button label="Retry" variant="ghost" loading={retrying} onPress={onRetry} />
      </View>
    </Screen>
  );
}

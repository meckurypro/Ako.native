// File: components/account/AccountUnderReview.tsx
import { useState } from "react";
import { View } from "react-native";
import { Icon } from "@/components/core/Icon";
import { Button, Screen, Text } from "@/components/core";
import { friendlyAuthError } from "@/features/auth/validation";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

// The pending user's entire app while the review gate is enforced (mirrors web's AccountUnderReview). Logging out is the only action.
export function AccountUnderReview() {
  const { signOut } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logout = async () => {
    setLoading(true);
    setError(null);
    try { await signOut(); } catch (err) { setError(friendlyAuthError(err, "Couldn’t log out. Check your connection and try again.")); setLoading(false); }
  };
  return (
    <Screen scroll={false} contentStyle={{ justifyContent: "center", alignItems: "center" }}>
      <View style={{ maxWidth: 320, alignItems: "center" }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <Icon name="clock-3" size={28} color={colors.accent} />
        </View>
        <Text variant="title" align="center" style={{ marginBottom: 8 }}>Your Akọ account is under review</Text>
        <Text color="secondary" align="center" style={{ marginBottom: 4 }}>We’re carefully welcoming people into Akọ during this early period. Your account has been received and is currently being reviewed.</Text>
        <Text color="secondary" align="center" style={{ marginBottom: 32 }}>There’s nothing else you need to do right now — check back soon, or we’ll be in touch.</Text>
        {error ? <Text variant="caption" color="danger" align="center" accessibilityRole="alert" style={{ marginBottom: 12 }}>{error}</Text> : null}
        <Button label="Log out" variant="ghost" loading={loading} onPress={() => void logout()} />
      </View>
    </Screen>
  );
}

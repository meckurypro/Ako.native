// File: screens/onboarding/OnboardingStepGuard.tsx
//
// Port of web's pages/onboarding/OnboardingStepGuard.tsx, with web's
// `<RequireAuth skipOnboardingCheck>` wrapper folded in (native has no
// RequireAuth yet): a signed-out visitor bounces to /login, and someone
// who has ALREADY completed onboarding is sent on to /feed instead of
// re-entering it (stale back-stack entry, deep link). Wrap every
// onboarding screen's content with this.
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { useOnboardingStatus } from "../../hooks/useOnboarding";
import { useTheme } from "../../lib/theme";

export function OnboardingStepGuard({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const { data: onboarding, isLoading } = useOnboardingStatus();

  if (authLoading || (!!user && isLoading)) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  if (onboarding?.completed) return <Redirect href="/feed" />;

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});

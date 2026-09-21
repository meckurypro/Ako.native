// File: app/index.tsx
// Root route ("/"). Reads useAuth() so a returning signed-in user isn't
// bounced to the login form on every launch (lib/supabase.ts persists the
// session to AsyncStorage), and — same rule as web's RequireAuth — sends
// someone who hasn't finished onboarding back into it instead of /feed:
// resume at Find People if they already saved interests, else Welcome.
// (OnboardingGate applies the same rule to every other route.)
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useAuth } from "../hooks/useAuth";
import { useOnboardingStatus } from "../hooks/useOnboarding";
import { useTheme } from "../lib/theme";

// Keep the native splash screen up while auth state resolves, instead
// of flashing this screen's own loading view first — smoother cold
// start. Call must happen at module scope, before the component mounts.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Fails harmlessly if already called elsewhere (e.g. fast refresh) —
  // nothing to do about it either way.
});

export default function Index() {
  const { user, loading } = useAuth();
  const { data: onboarding, isLoading: onboardingLoading } = useOnboardingStatus();
  const { colors } = useTheme();
  const resolving = loading || (!!user && onboardingLoading);

  useEffect(() => {
    if (!resolving) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [resolving]);

  if (resolving) {
    // Native splash screen is still covering this in the common case
    // (see above); this only becomes visible if hiding it is ever
    // delayed, so it should match the splash's own background rather
    // than flash a different color underneath it.
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  // A failed status lookup (onboarding undefined) falls through to /feed,
  // same as web's RequireAuth.
  if (onboarding && !onboarding.completed) {
    return <Redirect href={onboarding.hasInterests ? "/onboarding/people" : "/onboarding/welcome"} />;
  }
  return <Redirect href="/feed" />;
}

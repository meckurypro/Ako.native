// File: app/index.tsx
// Root route ("/"). Previously always redirected to /login regardless
// of auth state, which ignored the whole point of lib/supabase.ts
// persisting sessions to AsyncStorage — a returning signed-in user
// would get bounced to the login form on every app launch. This now
// reads useAuth() and sends them onward accordingly, same as
// LoginScreen already does for the reverse case (signed-in user
// landing on /login gets redirected past it).
//
// FLAG — this doesn't yet do RequireAuth's onboarding-completion
// check (see web's src/components/RequireAuth.tsx): a signed-in user
// who never finished onboarding will land on /feed here instead of
// being routed back into onboarding. That check depends on
// useOnboardingStatus/useAccountAccess, neither ported yet — revisit
// this redirect once those exist, the same way RequireAuth will need
// to.
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useAuth } from "../hooks/useAuth";
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
  const { colors } = useTheme();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading]);

  if (loading) {
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

  return <Redirect href={user ? "/feed" : "/login"} />;
}

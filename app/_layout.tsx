// File: app/_layout.tsx
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import { AppProviders } from "@/providers/AppProviders";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { AccountAccessError } from "@/components/account/AccountAccessError";
import { AccountUnderReview } from "@/components/account/AccountUnderReview";
import { AppSplash } from "@/components/feedback/AppSplash";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { useAccountAccess } from "@/features/account/api";
import { fontAssets } from "@/theme/fonts";

void SplashScreen.preventAutoHideAsync();
configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

function AppNavigator() {
  const { isReady, session } = useAuth(); const { colors, isDark } = useTheme(); const [showSplash, setShowSplash] = useState(true);
  // Account-review gate (web: RequireAuth + AccountUnderReview). Applies to every route, including deep links, because it replaces the navigator itself.
  // Stale-while-revalidate, not fail-closed: the Stack renders immediately and the check reconciles in the background (first launch is covered by
  // AppSplash below, not by blocking the Stack — see `ready` on AppSplash). A previously-loaded screen never gets yanked to a spinner just because the
  // access query is loading or refetching (e.g. on app foreground). Only a *confirmed* declined/suspended account (isBlocked) gets the full-screen
  // block; a genuine fetch error with no earlier cached answer still shows the error screen so a broken check can't silently no-op. A pending account
  // gets full navigation into the app, with individual pages/actions locked per-feature (see features/account/probational.ts and ProbationalLock).
  const access = useAccountAccess(); const accessPending = !!session && access.isLoading; const accessFailed = !!session && access.isError && !access.data; const blocked = !!session && access.data?.isBlocked === true;
  const onLayout = useCallback(() => { void SplashScreen.hideAsync(); }, []);
  const gate = blocked ? <AccountUnderReview /> : accessFailed ? <AccountAccessError onRetry={() => void access.refetch()} retrying={access.isFetching} /> : null;
  return <View onLayout={onLayout} style={{ flex: 1, backgroundColor: colors.background }}><StatusBar style={isDark ? "light" : "dark"} />{gate ?? <ErrorBoundary><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "fade_from_bottom" }}><Stack.Screen name="(auth)" /><Stack.Screen name="(onboarding)" /><Stack.Screen name="(tabs)" /><Stack.Screen name="auth/callback" /><Stack.Screen name="auth/reset-password" /><Stack.Screen name="profile/edit" /><Stack.Screen name="modals/create" options={{ presentation: "transparentModal", animation: "fade", contentStyle: { backgroundColor: "transparent" } }} /><Stack.Screen name="modals/logout-confirm" options={{ presentation: "transparentModal", animation: "fade" }} /></Stack></ErrorBoundary>}{showSplash && <AppSplash ready={isReady && !accessPending} onFinished={() => setShowSplash(false)} />}</View>;
}

export default function RootLayout() {
  // Keep the native splash screen up (preventAutoHideAsync above) until
  // Playfair Display/Inter/Roboto are actually loaded — otherwise the
  // very first frame renders in the OS default font and every screen
  // visibly re-flows/re-paints text a beat later. AppNavigator's own
  // onLayout call (which hides the splash) never fires until this
  // returns non-null, so there's no risk of hiding it early.
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  if (!fontsLoaded && !fontError) return null;
  return <AppProviders><AppNavigator /></AppProviders>;
}

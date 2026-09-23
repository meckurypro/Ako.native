import { Redirect, Stack, useLocalSearchParams, useSegments } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
const addModeSegments = new Set(["sign-in", "sign-up"]);
export default function AuthLayout() { const { session, isReady, onboardingComplete, sessionExpired } = useAuth(); const segments = useSegments(); const params = useLocalSearchParams<{ add?: string }>(); const addMode = addModeSegments.has(segments.at(-1) ?? "") && params.add === "1"; if (!isReady) return null; if (session && !addMode) return <Redirect href={onboardingComplete ? "/(tabs)/home" : "/(onboarding)"} />; if (sessionExpired && segments.at(-1) !== "session-expired") return <Redirect href="/(auth)/session-expired" />; return <Stack screenOptions={{ headerShown: false }} />; }

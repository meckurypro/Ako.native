import { Redirect, Stack, useSegments } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
export default function AuthLayout() { const { session, isReady, onboardingComplete, sessionExpired } = useAuth(); const segments = useSegments(); if (!isReady) return null; if (session) return <Redirect href={onboardingComplete ? "/(tabs)/home" : "/(onboarding)"} />; if (sessionExpired && segments.at(-1) !== "session-expired") return <Redirect href="/(auth)/session-expired" />; return <Stack screenOptions={{ headerShown: false }} />; }

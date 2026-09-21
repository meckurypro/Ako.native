import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
export default function OnboardingLayout() { const { session, isReady, onboardingComplete } = useAuth(); if (!isReady) return null; if (!session) return <Redirect href="/(auth)" />; if (onboardingComplete) return <Redirect href="/(tabs)/home" />; return <Stack screenOptions={{ headerShown: false }} />; }

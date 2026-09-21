import { Redirect } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
export default function Index() { const { session, isReady, onboardingComplete } = useAuth(); if (!isReady) return null; if (!session) return <Redirect href="/(auth)" />; if (!onboardingComplete) return <Redirect href="/(onboarding)" />; return <Redirect href="/(tabs)/home" />; }

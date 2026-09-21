import { Redirect } from "expo-router";
import { Screen, Text } from "@/components/core";
import { useOnboardingStatus } from "@/features/onboarding/api";
export default function OnboardingGate(){const status=useOnboardingStatus();if(status.isLoading)return <Screen contentStyle={{justifyContent:"center"}}><Text color="secondary" align="center">Restoring your progress…</Text></Screen>;if(status.isError)return <Screen contentStyle={{justifyContent:"center"}}><Text color="danger" align="center">Couldn’t restore onboarding. Check your connection and try again.</Text></Screen>;return <Redirect href={status.data?.hasInterests?"/(onboarding)/people":"/(onboarding)/welcome"}/>;}

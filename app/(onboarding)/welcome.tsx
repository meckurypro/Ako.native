import { useRouter } from "expo-router";
import { Button, Screen, Text } from "@/components/core";
export default function OnboardingWelcome(){const router=useRouter();return <Screen contentStyle={{justifyContent:"center",alignItems:"center",gap:16}}><Text variant="display" color="accent">AKọ</Text><Text variant="title" align="center">Welcome to AKọ</Text><Text color="secondary" align="center">Tell us what interests you. We’ll help you find your people.</Text><Button label="Get started" onPress={()=>router.push("/(onboarding)/interests")} /></Screen>}

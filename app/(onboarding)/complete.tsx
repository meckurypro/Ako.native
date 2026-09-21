import { useEffect, useRef, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Button, Screen, Text } from "@/components/core";
import { useTheme } from "@/providers/ThemeProvider";
import { useCompleteOnboarding } from "@/features/onboarding/api";
import { friendlyAuthError } from "@/features/auth/validation";
export default function Complete(){const router=useRouter();const{colors}=useTheme();const complete=useCompleteOnboarding();const mutateAsync=complete.mutateAsync;const ran=useRef(false);const[error,setError]=useState<string|null>(null);const run=async()=>{setError(null);try{await mutateAsync();router.replace("/(tabs)/home");}catch(err){setError(friendlyAuthError(err,"Couldn’t finish setup. Check your connection and try again."));}};useEffect(()=>{if(ran.current)return;ran.current=true;void mutateAsync().then(()=>router.replace("/(tabs)/home")).catch(err=>setError(friendlyAuthError(err,"Couldn’t finish setup. Check your connection and try again.")));},[mutateAsync,router]);return <Screen contentStyle={{justifyContent:"center",alignItems:"center",gap:14}}>{error?<><Text variant="title">Something went wrong</Text><Text color="secondary" align="center">{error}</Text><Button label="Try again" loading={complete.isPending} onPress={()=>void run()} /></>:<><ActivityIndicator size="large" color={colors.accent}/><Text variant="title">Building your AKọ…</Text><Text color="secondary">Getting your account ready.</Text></>}</Screen>}

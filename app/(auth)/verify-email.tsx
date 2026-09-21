import { useState } from "react";
import { View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { AuthScreen } from "@/components/navigation/AuthScreen";
import { Button, Text } from "@/components/core";
import { useAuth } from "@/providers/AuthProvider";
import { friendlyAuthError } from "@/features/auth/validation";
export default function VerifyEmail(){const params=useLocalSearchParams<{email?:string}>();const email=typeof params.email==="string"?params.email:"";const {resendVerification}=useAuth();const [loading,setLoading]=useState(false);const [sent,setSent]=useState(false);const [error,setError]=useState<string|null>(null);const resend=async()=>{if(!email)return;setLoading(true);setError(null);try{await resendVerification(email);setSent(true);}catch(err){setError(friendlyAuthError(err,"Couldn't resend the confirmation link."));}finally{setLoading(false);}};return <AuthScreen title="Check your email" subtitle={email?`We sent a confirmation link to ${email}. Open it to activate your account.`:"Open the confirmation link sent to your email."}><View style={{gap:12}}>{error&&<Text variant="caption" color="danger">{error}</Text>}<Button label={sent?"Link sent":"Resend confirmation"} variant="secondary" loading={loading} disabled={!email||sent} onPress={()=>void resend()} /><Link href="/(auth)/sign-in" asChild><Button label="Back to sign in" variant="ghost" /></Link></View></AuthScreen>}

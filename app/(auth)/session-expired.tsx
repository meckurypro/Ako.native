import { Link } from "expo-router";
import { AuthScreen } from "@/components/navigation/AuthScreen";
import { Button } from "@/components/core";
export default function SessionExpired(){return <AuthScreen title="Session expired" subtitle="For your security, sign in again to continue."><Link href="/(auth)/sign-in" asChild><Button label="Sign in again" /></Link></AuthScreen>}

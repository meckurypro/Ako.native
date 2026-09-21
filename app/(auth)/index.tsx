import { View } from "react-native";
import { Link } from "expo-router";
import { AuthScreen } from "@/components/navigation/AuthScreen";
import { Button, Text } from "@/components/core";
export default function Welcome() { return <AuthScreen title="Your people. Your work. Your AKọ." subtitle="Join a thoughtful community of creators, builders and curious minds."><View style={{ gap: 12 }}><Link href="/(auth)/sign-up" asChild><Button label="Create an account" /></Link><Link href="/(auth)/sign-in" asChild><Button label="Sign in" variant="secondary" /></Link></View><Text variant="caption" color="muted" align="center">One account works across AKọ web and mobile.</Text></AuthScreen>; }

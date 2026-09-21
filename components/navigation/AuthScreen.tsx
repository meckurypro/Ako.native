import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Screen, Text } from "@/components/core";
import { FadeIn } from "@/components/feedback";
export function AuthScreen({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle: string }>) { return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}><Screen contentStyle={{ justifyContent: "center", paddingVertical: 36 }}><FadeIn><View style={{ gap: 24 }}><View style={{ alignItems: "center", gap: 6 }}><Text variant="display" color="accent">AKọ</Text><Text variant="title" align="center">{title}</Text><Text color="secondary" align="center">{subtitle}</Text></View>{children}</View></FadeIn></Screen></KeyboardAvoidingView>; }

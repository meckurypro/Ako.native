import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Screen, Text } from "@/components/core";
import { FadeIn } from "@/components/feedback";
import { AuthPattern } from "@/components/auth/AuthPattern";
import { useTheme } from "@/providers/ThemeProvider";
// AuthPattern sits behind Screen (which renders `transparent` here so the
// pattern shows through) — matches web's AuthPattern-behind-form layering.
export function AuthScreen({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle: string }>) { const { colors } = useTheme(); return <View style={{ flex: 1, backgroundColor: colors.background }}><AuthPattern /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}><Screen transparent contentStyle={{ justifyContent: "center", paddingVertical: 36 }}><FadeIn><View style={{ gap: 24 }}><View style={{ alignItems: "center", gap: 6 }}><Text variant="display" color="accent">AKọ</Text><Text variant="title" align="center">{title}</Text><Text color="secondary" align="center">{subtitle}</Text></View>{children}</View></FadeIn></Screen></KeyboardAvoidingView></View>; }

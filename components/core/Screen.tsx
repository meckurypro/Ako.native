import type { PropsWithChildren } from "react";
import { ScrollView, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/providers/ThemeProvider";
type Props = PropsWithChildren<{ scroll?: boolean; contentStyle?: ViewStyle; edges?: ("top" | "bottom" | "left" | "right")[] }>;
export function Screen({ children, scroll = true, contentStyle, edges = ["top", "left", "right"] }: Props) {
  const { colors } = useTheme();
  const content = { flexGrow: scroll ? 1 : undefined, paddingHorizontal: 20, paddingBottom: 28, ...contentStyle };
  return <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>{scroll ? <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView> : <View style={[{ flex: 1 }, content]}>{children}</View>}</SafeAreaView>;
}

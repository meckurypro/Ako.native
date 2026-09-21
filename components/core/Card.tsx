import type { PropsWithChildren } from "react";
import { View, type ViewProps } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";
export function Card({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  const { colors, radii, spacing } = useTheme();
  return <View {...props} style={[{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: spacing[4], shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, style]}>{children}</View>;
}

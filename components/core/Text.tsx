import type { PropsWithChildren } from "react";
import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";

type Variant = "display" | "title" | "heading" | "body" | "label" | "caption";
type Props = TextProps & PropsWithChildren<{ variant?: Variant; color?: "primary" | "secondary" | "muted" | "accent" | "danger"; align?: TextStyle["textAlign"] }>;

export function Text({ variant = "body", color = "primary", align, style, children, ...props }: Props) {
  const theme = useTheme();
  const colors = { primary: theme.colors.text, secondary: theme.colors.textSecondary, muted: theme.colors.textMuted, accent: theme.colors.accent, danger: theme.colors.danger };
  return <RNText {...props} style={[theme.typography[variant], { color: colors[color], textAlign: align }, style]}>{children}</RNText>;
}

export function Heading(props: Omit<Props, "variant">) {
  return <Text variant="heading" accessibilityRole="header" {...props} />;
}

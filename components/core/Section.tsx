import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";
import { Heading, Text } from "./Text";
export function Section({ title, description, action, children }: PropsWithChildren<{ title: string; description?: string; action?: ReactNode }>) {
  return <View style={{ gap: 12, marginTop: 26 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><View style={{ flex: 1 }}><Heading>{title}</Heading>{description && <Text variant="caption" color="secondary" style={{ marginTop: 3 }}>{description}</Text>}</View>{action}</View>{children}</View>;
}

// File: components/feedback/ErrorBoundary.tsx
//
// Native mirror of web's src/components/ErrorBoundary.tsx (cd85ca2). Native
// had zero error boundaries anywhere, so one uncaught render error white-
// screened the whole app with no recovery path. This wraps the navigator in
// app/_layout.tsx and offers a way back to the home tab instead of a blank
// screen.
//
// Class component because getDerivedStateFromError/componentDidCatch have no
// hook equivalent; the fallback UI itself is a plain function component so it
// can use useTheme/useRouter normally.
import { Component, type ReactNode } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Text } from "@/components/core";
import { useTheme } from "@/providers/ThemeProvider";

function ErrorFallback({ onReset }: { onReset: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 24, backgroundColor: colors.background }}>
      <Text variant="label">Something went wrong.</Text>
      <Button
        label="Back to feed"
        onPress={() => {
          onReset();
          router.replace("/(tabs)/home");
        }}
      />
    </View>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("Ako crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

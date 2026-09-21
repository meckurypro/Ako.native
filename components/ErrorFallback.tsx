// File: components/ErrorFallback.tsx
//
// Port of web's ErrorBoundary fallback, wired through expo-router's
// route-level boundary (see the `ErrorBoundary` export in app/_layout.tsx)
// instead of a hand-rolled class component.
//
// DIFFERENCE FROM WEB: web's button is "Back to feed" (a hard reload to
// /feed). The root layout's boundary REPLACES the whole navigator while
// it's showing, so there is nothing for router.replace("/feed") to act on
// — and re-mounting the navigator lands on the same crashed screen. The
// button is therefore "Try again" (expo-router's `retry`, which clears the
// error and re-renders). Because this renders outside the layout's
// providers, it depends on nothing but the theme.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/theme";

interface ErrorFallbackProps {
  error: Error;
  retry: () => Promise<void>;
}

export function ErrorFallback({ error, retry }: ErrorFallbackProps) {
  const { colors } = useTheme();
  console.error("Ako crashed:", error);

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <Text style={[styles.title, { color: colors.ink }]}>Something went wrong.</Text>
      <Pressable
        onPress={() => void retry()}
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: colors.accent }]}
      >
        <Text style={[styles.buttonText, { color: colors.canvas }]}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // min-h-screen flex-col items-center justify-center gap-4 px-6 text-center
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  title: { fontSize: 16, fontWeight: "500", textAlign: "center" },
  // px-5 py-2 rounded-full text-sm font-medium
  button: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 999 },
  buttonText: { fontSize: 14, fontWeight: "500" },
});

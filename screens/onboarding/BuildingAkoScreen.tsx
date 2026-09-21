// File: screens/onboarding/BuildingAkoScreen.tsx
// (routed to via app/onboarding/building.tsx)
//
// Port of web's pages/onboarding/BuildingAko.tsx — step 4. Interests and
// follows are already persisted (earlier steps write as the user picks
// them), so the one thing left is flipping the completion flag
// server-side. That's real work, not a fake delay — the minimum display
// time only keeps it from flashing on a fast connection.
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCompleteOnboarding } from "../../hooks/useOnboarding";
import { Wordmark } from "../../components/Wordmark";
import { Button } from "../../components/Button";
import { AuthPattern } from "../../components/AuthPattern";
import { useTheme } from "../../lib/theme";
import { OnboardingStepGuard } from "./OnboardingStepGuard";

const MIN_DISPLAY_MS = 1100;

export function BuildingAkoScreen() {
  return (
    <OnboardingStepGuard>
      <BuildingAko />
    </OnboardingStepGuard>
  );
}

function BuildingAko() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { mutateAsync: completeOnboarding, isPending } = useCompleteOnboarding();
  const [failed, setFailed] = useState(false);
  const cancelledRef = useRef(false);

  const run = useCallback(async () => {
    setFailed(false);
    const startedAt = Date.now();
    try {
      await completeOnboarding();

      const elapsed = Date.now() - startedAt;
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, MIN_DISPLAY_MS - elapsed)));

      if (!cancelledRef.current) router.replace("/feed");
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      if (!cancelledRef.current) setFailed(true);
    }
  }, [completeOnboarding, router]);

  useEffect(() => {
    cancelledRef.current = false;
    run();
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.canvas, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <AuthPattern />
      <View style={styles.content}>
        <View style={styles.wordmarkWrap}>
          <Wordmark />
        </View>

        {!failed ? (
          <>
            {/* web: 32px accent ring spinner */}
            <ActivityIndicator size="large" color={colors.accent} style={styles.spinner} />
            {/* font-display (Playfair Display) — not a loaded RN font yet. */}
            <Text style={[styles.title, { color: colors.ink }]}>Building your Akọ…</Text>
            <Text style={[styles.body, { color: colors.inkMuted }]}>Getting your feed ready.</Text>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.ink }]}>Something went wrong</Text>
            <Text style={[styles.body, { color: colors.inkMuted, marginBottom: 24 }]}>
              We couldn't finish setting up your Akọ. Check your connection and try again.
            </Text>
            <View style={styles.retry}>
              <Button onPress={run} loading={isPending}>
                Try again
              </Button>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, overflow: "hidden" },
  content: { alignItems: "center" },
  wordmarkWrap: { marginBottom: 32 },
  spinner: { marginBottom: 24 },
  // web: text-xl mb-2 / text-sm max-w-xs
  title: { fontSize: 20, lineHeight: 28, marginBottom: 8, textAlign: "center" },
  body: { fontSize: 14, lineHeight: 20, maxWidth: 320, textAlign: "center" },
  retry: { width: 160 },
});

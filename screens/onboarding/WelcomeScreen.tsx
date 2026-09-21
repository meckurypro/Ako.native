// File: screens/onboarding/WelcomeScreen.tsx
// (routed to via app/onboarding/welcome.tsx)
//
// Port of web's pages/onboarding/Welcome.tsx — step 1, deliberately just a
// landing beat, not a tutorial. Same AuthPattern background as the auth
// screens, since onboarding is a direct continuation of that flow.
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wordmark } from "../../components/Wordmark";
import { Button } from "../../components/Button";
import { AuthPattern } from "../../components/AuthPattern";
import { useTheme } from "../../lib/theme";
import { OnboardingStepGuard } from "./OnboardingStepGuard";

export function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <OnboardingStepGuard>
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

          {/* font-display (Playfair Display) isn't a loaded RN font yet —
              same gap as the auth screens; swap fontFamily in once it's
              registered via expo-font. */}
          <Text style={[styles.title, { color: colors.ink }]}>Welcome to Akọ</Text>
          <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
            Tell us what interests you. We'll help you find your people.
          </Text>

          <View style={styles.cta}>
            <Button onPress={() => router.push("/onboarding/interests")}>Get started</Button>
          </View>
        </View>
      </View>
    </OnboardingStepGuard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, overflow: "hidden" },
  content: { alignItems: "center", width: "100%" },
  wordmarkWrap: { marginBottom: 40 },
  // web: text-2xl mb-3 / text-ink-muted mb-10 max-w-xs / w-full max-w-xs
  title: { fontSize: 24, lineHeight: 32, marginBottom: 12, textAlign: "center" },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 40, maxWidth: 320, textAlign: "center" },
  cta: { width: "100%", maxWidth: 320 },
});

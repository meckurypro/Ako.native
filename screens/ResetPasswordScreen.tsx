// File: screens/ResetPasswordScreen.tsx
// (routed to via app/(auth)/reset-password.tsx, which just re-exports
// this as the default)
//
// Ported from web's src/pages/auth/ResetPassword.tsx — same 4-step
// flow (email → sent → new_password → done), same
// don't-leak-whether-the-email-exists behavior on request, same
// updateUser() call relying on a recovery session already being
// established. See that file for the full reasoning.
//
// Native-specific swaps:
//   - web enters "new_password" directly via router state
//     (`state: { fromRecovery: true }`) set by AuthCallback.tsx after it
//     sees Supabase's PASSWORD_RECOVERY event. Expo Router has no state
//     passing, so this reads a `fromRecovery` query param instead —
//     whatever opens this screen after handling that event should
//     navigate here with `?fromRecovery=1`.
//   - `redirectTo: window.location.origin + "/auth/callback"` has no RN
//     equivalent — built with expo-linking's Linking.createURL()
//     instead, same as SignUpScreen's emailRedirectTo.
//
// FLAG — this screen's "sent" step (request a reset link) works
// standalone right now, but reaching "new_password" for real depends on
// a native AuthCallback screen that isn't built yet: something needs to
// register a deep-link handler for the "ako://auth/callback" URL the
// reset email points at, listen for supabase.auth.onAuthStateChange's
// PASSWORD_RECOVERY event the way web's AuthCallback.tsx does, and only
// then route here with ?fromRecovery=1. Until that exists, tapping the
// email link on a device won't land a user on the new_password step.
import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams, Link } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";
import { Wordmark } from "../components/Wordmark";
import { AuthPattern } from "../components/AuthPattern";
import { FormField } from "../components/FormField";
import { PasswordField } from "../components/PasswordField";
import { Button } from "../components/Button";

type Step = "email" | "sent" | "new_password" | "done";

export function ResetPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ fromRecovery?: string }>();

  // See the FLAG above — this only ever gets set once a native
  // AuthCallback equivalent exists to pass it along.
  const [step, setStep] = useState<Step>(params.fromRecovery === "1" ? "new_password" : "email");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestLink() {
    setError(null);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Linking.createURL("/auth/callback"),
    });

    setLoading(false);

    // Deliberately proceed to the "sent" step regardless of whether the
    // email exists — revealing "no account with that email" is an
    // account-enumeration leak. Supabase itself follows this pattern.
    if (resetError) {
      console.error("resetPasswordForEmail error:", resetError.message);
    }

    setStep("sent");
  }

  async function handleSetNewPassword() {
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    // A valid recovery session (established via the native
    // AuthCallback handler) is what lets updateUser() work here.
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setStep("done");
    setTimeout(() => router.replace("/feed"), 1500);
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.canvas }]}>
      <AuthPattern />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.wordmarkWrap}>
            <Wordmark />
          </View>

          {step === "email" && (
            <>
              <Text style={[styles.heading, { color: colors.ink }]}>Reset password</Text>
              <Text style={[styles.subheading, { color: colors.inkMuted }]}>
                Enter your email and we'll send you a link.
              </Text>
              <FormField
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
              />
              <Button onPress={handleRequestLink} disabled={loading} loading={loading}>
                Send link
              </Button>
            </>
          )}

          {step === "sent" && (
            <View style={styles.centered}>
              <Text style={[styles.heading, { color: colors.ink }]}>Check your email</Text>
              <Text style={[styles.subheading, { color: colors.inkMuted }]}>
                If an account exists for{" "}
                <Text style={[styles.emailHighlight, { color: colors.ink }]}>{email}</Text>,
                we've sent a link to reset your password.
              </Text>
            </View>
          )}

          {step === "new_password" && (
            <>
              <Text style={[styles.heading, { color: colors.ink }]}>New password</Text>
              <Text style={[styles.subheading, { color: colors.inkMuted }]}>
                Choose a new password for your account.
              </Text>
              <PasswordField
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                autoFocus
              />
              {error ? (
                <Text style={[styles.errorText, { color: colors.danger }]} accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
              <Button onPress={handleSetNewPassword} disabled={loading} loading={loading}>
                Update password
              </Button>
            </>
          )}

          {step === "done" && (
            <Text style={[styles.doneText, { color: colors.accent }]}>
              Password updated. Taking you to your feed…
            </Text>
          )}

          {step === "email" && (
            <View style={styles.loginRow}>
              <Text style={[styles.loginText, { color: colors.inkMuted }]}>Remembered it? </Text>
              <Link href="/login" style={[styles.loginLink, { color: colors.accent }]}>
                Log in
              </Link>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  wordmarkWrap: { marginBottom: 40 },
  centered: { alignItems: "center" },
  // font-display (Playfair Display) isn't wired up as a loaded RN font
  // yet — swap fontFamily in once it's registered via useFonts/expo-font.
  heading: { fontSize: 22, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  subheading: { fontSize: 14, marginBottom: 24, textAlign: "center" },
  emailHighlight: { fontWeight: "600" },
  errorText: { fontSize: 14, marginBottom: 16 },
  doneText: { fontSize: 16, fontWeight: "500", textAlign: "center" },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  loginText: { fontSize: 14 },
  loginLink: { fontSize: 14, fontWeight: "500" },
});

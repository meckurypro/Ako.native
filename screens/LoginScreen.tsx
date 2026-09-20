// File: screens/LoginScreen.tsx
// (routed to via app/(auth)/login.tsx, which just re-exports this as the default)
//
// Ported from web's src/pages/auth/Login.tsx — same fields, same copy,
// same error handling and add-account flow, restyled with RN's
// components/theme tokens instead of Tailwind classes. See that file
// for the reasoning behind each behavior (redirect param handling,
// unconfirmed-email resend, generic incorrect-email-or-password
// message, etc) — it's preserved verbatim here.
import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Redirect, useRouter, useLocalSearchParams, Link } from "expo-router";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { useAddAccount } from "../hooks/useAccountSwitcher";
import { useTheme } from "../lib/theme";
import { Wordmark } from "../components/Wordmark";
import { AuthPattern } from "../components/AuthPattern";
import { FormField } from "../components/FormField";
import { PasswordField } from "../components/PasswordField";
import { Button } from "../components/Button";

export function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ redirect?: string; add?: string }>();
  const redirectTo =
    params.redirect && params.redirect.startsWith("/") && !params.redirect.startsWith("//")
      ? params.redirect
      : "/feed";
  // ?add=1 — arrived here to sign into an ADDITIONAL personal account
  // rather than replace the current one. See web's Login.tsx for the
  // full rationale; behavior here matches it exactly.
  const addMode = params.add === "1";
  const addAccount = useAddAccount();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  if (!addMode && !authLoading && user) {
    return <Redirect href={redirectTo} />;
  }

  async function handleSubmit() {
    setError(null);
    setUnconfirmed(false);
    setLoading(true);

    if (addMode) {
      try {
        const newProfile = await addAccount.mutateAsync({ email, password });
        setLoading(false);
        router.replace(`/profile/${newProfile.username}`);
      } catch (err: any) {
        setLoading(false);
        setError(err.message ?? "Incorrect email or password.");
      }
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      // "Email not confirmed" is a distinct failure from a bad
      // password/email — surface it separately rather than collapsing
      // every error into the generic message below.
      if (signInError.message.toLowerCase().includes("email not confirmed")) {
        setUnconfirmed(true);
        setError("Confirm your email first. Check your inbox for the link we sent you.");
      } else {
        // Generic message deliberately — don't reveal whether the email
        // exists or the password was wrong.
        setError("Incorrect email or password.");
      }
      return;
    }

    router.replace(redirectTo);
  }

  async function handleResend() {
    setResending(true);
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (!resendError) {
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    }
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

          {addMode && (
            <Text style={[styles.addModeText, { color: colors.inkMuted }]}>
              Sign into another personal account. Your current account stays saved on this
              device — switch back to it anytime.
            </Text>
          )}

          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoFocus
          />
          <PasswordField label="Password" value={password} onChangeText={setPassword} />

          {error ? (
            <Text style={[styles.errorText, { color: colors.danger }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          {unconfirmed && (
            <Pressable onPress={handleResend} disabled={resending} style={styles.resendLink}>
              <Text style={[styles.resendLinkText, { color: colors.accent }]}>
                {resending ? "Sending…" : resent ? "Link sent" : "Resend confirmation link"}
              </Text>
            </Pressable>
          )}

          <Button onPress={handleSubmit} disabled={loading} loading={loading}>
            {addMode ? "Add account" : "Log in"}
          </Button>

          {!addMode && (
            <Link href="/reset-password" style={[styles.forgotLink, { color: colors.accent }]}>
              Forgot password?
            </Link>
          )}

          <View style={styles.signupRow}>
            <Text style={[styles.signupText, { color: colors.inkMuted }]}>New to Akọ? </Text>
            <Link
              href={addMode ? "/signup?add=1" : "/signup"}
              style={[styles.signupLink, { color: colors.accent }]}
            >
              Create an account
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  wordmarkWrap: { marginBottom: 40 },
  addModeText: { textAlign: "center", fontSize: 14, marginBottom: 24 },
  errorText: { fontSize: 14, marginBottom: 16 },
  resendLink: { marginBottom: 16 },
  resendLinkText: { fontSize: 14, fontWeight: "500" },
  forgotLink: { textAlign: "center", fontSize: 14, marginTop: 16 },
  signupRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  signupText: { fontSize: 14 },
  signupLink: { fontSize: 14, fontWeight: "500" },
});

// File: screens/LoginScreen.tsx
// (routed to via app/(auth)/login.tsx, which just re-exports this as the default)
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
import { Redirect, useRouter, useLocalSearchParams, Link } from "expo-router"; // FLAG: assumes Expo Router — swap for React Navigation calls if you're using that instead
import { useAuth } from "../hooks/useAuth"; // FLAG: this hook needs its own RN pass — see note below
import { supabase } from "../lib/supabase"; // FLAG: Supabase client needs AsyncStorage-based session storage on RN — see note below
import { useAddAccount } from "../hooks/useAccountSwitcher"; // FLAG: not yet converted — port when you get to account switching
import { Wordmark } from "../components/Wordmark";
import { FormField } from "../components/FormField";
import { PasswordField } from "../components/PasswordField";
import { Button } from "../components/Button";
// NOTE: AuthPattern (decorative background) intentionally dropped for
// this first pass — it's a visual-only component; port it separately
// once you've decided how you want background art handled on native.

export function LoginScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ redirect?: string; add?: string }>();
  const redirectTo =
    params.redirect && params.redirect.startsWith("/") && !params.redirect.startsWith("//")
      ? params.redirect
      : "/feed";
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
      if (signInError.message.toLowerCase().includes("email not confirmed")) {
        setUnconfirmed(true);
        setError("Confirm your email first. Check your inbox for the link we sent you.");
      } else {
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.wordmarkWrap}>
          <Wordmark />
        </View>

        {addMode && (
          <Text style={styles.addModeText}>
            Sign into another personal account. Your current account stays saved on this device —
            switch back to it anytime.
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
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {unconfirmed && (
          <Pressable onPress={handleResend} disabled={resending} style={styles.resendLink}>
            <Text style={styles.resendLinkText}>
              {resending ? "Sending…" : resent ? "Link sent" : "Resend confirmation link"}
            </Text>
          </Pressable>
        )}

        <Button onPress={handleSubmit} disabled={loading}>
          {addMode ? "Add account" : "Log in"}
        </Button>

        {!addMode && (
          <Link href="/reset-password" style={styles.forgotLink}>
            Forgot password?
          </Link>
        )}

        <View style={styles.signupRow}>
          <Text style={styles.signupText}>New to Akọ? </Text>
          <Link href={addMode ? "/signup?add=1" : "/signup"} style={styles.signupLink}>
            Create an account
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#FFFFFF" }, // canvas
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  wordmarkWrap: { marginBottom: 40 },
  addModeText: { textAlign: "center", fontSize: 14, color: "#6B7280", marginBottom: 24 },
  errorText: { color: "#DC2626", fontSize: 14, marginBottom: 16 },
  resendLink: { marginBottom: 16 },
  resendLinkText: { fontSize: 14, color: "#2563EB", fontWeight: "500" },
  forgotLink: { textAlign: "center", fontSize: 14, color: "#2563EB", marginTop: 16 },
  signupRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  signupText: { fontSize: 14, color: "#6B7280" },
  signupLink: { fontSize: 14, color: "#2563EB", fontWeight: "500" },
});

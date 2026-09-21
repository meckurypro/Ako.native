// File: screens/VerifyEmailScreen.tsx
// (routed to via app/(auth)/verify-email.tsx, which just re-exports this)
//
// Ported from web's src/pages/auth/VerifyEmail.tsx — same copy, same
// resend behavior. Native differences:
//   - The email arrives as a route param (SignUpScreen does
//     router.push({ pathname: "/verify-email", params: { email } })),
//     where web uses router state. Landing here without it (cold deep
//     link, restored stale route) bounces back to /signup, like web.
//   - The resend's emailRedirectTo is Linking.createURL("/auth/callback"),
//     the same deep link SignUpScreen uses, so the confirmation link
//     reopens the app at AuthCallbackScreen instead of a web origin.
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link, Redirect, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";
import { Wordmark } from "../components/Wordmark";
import { AuthPattern } from "../components/AuthPattern";

export function VerifyEmailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";

  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  // No email to show → nothing sensible to render; back to sign-up.
  if (!email) {
    return <Redirect href="/signup" />;
  }

  async function handleResend() {
    setResending(true);
    setError(null);

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: Linking.createURL("/auth/callback") },
    });

    setResending(false);

    if (resendError) {
      setError("Couldn't resend the link. Try again in a moment.");
      return;
    }

    setResent(true);
    resetTimer.current = setTimeout(() => setResent(false), 4000);
  }

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

        {/* font-display (Playfair Display) — not a loaded RN font yet. */}
        <Text style={[styles.title, { color: colors.ink }]}>Check your email</Text>
        <Text style={[styles.body, { color: colors.inkMuted }]}>
          We sent a confirmation link to{" "}
          <Text style={{ color: colors.ink, fontWeight: "500" }}>{email}</Text>. Open it to activate your
          account.
        </Text>

        {!!error && (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
            {error}
          </Text>
        )}

        <Pressable
          onPress={handleResend}
          disabled={resending}
          accessibilityRole="button"
          style={({ pressed }) => [(resending || pressed) && { opacity: 0.5 }]}
        >
          <Text style={[styles.link, { color: colors.accent }]}>
            {resending ? "Sending…" : resent ? "Link sent" : "Resend link"}
          </Text>
        </Pressable>

        <View style={styles.loginRow}>
          <Text style={[styles.loginText, { color: colors.inkMuted }]}>Already confirmed? </Text>
          <Link href="/login" style={[styles.loginText, styles.link, { color: colors.accent }]}>
            Back to log in
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, overflow: "hidden" },
  // web: w-full max-w-sm text-center
  content: { width: "100%", maxWidth: 384, alignItems: "center" },
  wordmarkWrap: { marginBottom: 32 },
  title: { fontSize: 24, lineHeight: 32, marginBottom: 8, textAlign: "center" },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 32, textAlign: "center" },
  error: { fontSize: 14, marginBottom: 16, textAlign: "center" },
  link: { fontSize: 14, fontWeight: "500" },
  loginRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 24 },
  loginText: { fontSize: 14 },
});

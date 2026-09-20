// File: screens/SignUpScreen.tsx
// (routed to via app/(auth)/signup.tsx, which just re-exports this as the default)
//
// Ported from web's src/pages/auth/SignUp.tsx — same fields, same
// debounced username-availability check, same add-account handoff and
// friendly-error mapping. See that file for the full reasoning; it's
// preserved verbatim here. Two native-specific swaps:
//   - web's `emailRedirectTo: window.location.origin + "/auth/callback"`
//     has no RN equivalent (no window/origin), so this builds the same
//     deep link with expo-linking's Linking.createURL() instead —
//     resolves to your app scheme (see app.json's "scheme": "ako"),
//     e.g. ako://auth/callback.
//   - react-router's `navigate("/verify-email", { state: { email } })`
//     passes email via history state, which expo-router doesn't have —
//     passed as a query param instead, read back on the receiving screen.
import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams, Link } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";
import { setPendingAddAccount } from "../lib/accountSessions";
import { useTheme } from "../lib/theme";
import { Wordmark } from "../components/Wordmark";
import { AuthPattern } from "../components/AuthPattern";
import { FormField } from "../components/FormField";
import { PasswordField } from "../components/PasswordField";
import { Button } from "../components/Button";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "error";

// Turns Supabase's raw auth error text into something a user can act
// on, and specifically catches "this email is already in use" so it
// reads like a normal validation error instead of a raw API message.
function friendlySignUpError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("already registered") ||
    lower.includes("already exists") ||
    lower.includes("already in use")
  ) {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (lower.includes("username") && (lower.includes("duplicate") || lower.includes("unique"))) {
    return "That username is already taken.";
  }
  return message;
}

export function SignUpScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ add?: string }>();
  // ?add=1 — arrived here from Login's "New to Akọ? Create an
  // account" link while adding a second account (see AccountSwitcher),
  // rather than as a fresh, signed-out sign-up.
  const addMode = params.add === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const usernameCheckId = useRef(0);

  // Debounced live availability check as the user types — this is a
  // UX nicety only. profiles.username is UNIQUE at the DB level, so
  // duplicates can never actually land there; this just catches the
  // common case early instead of making the user find out from a
  // failed submit.
  useEffect(() => {
    if (username.length < 3) {
      setUsernameStatus("idle");
      return;
    }

    const checkId = ++usernameCheckId.current;
    setUsernameStatus("checking");

    const timeout = setTimeout(async () => {
      const { data, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      // Ignore stale responses if the user kept typing.
      if (checkId !== usernameCheckId.current) return;

      if (checkError) {
        setUsernameStatus("error");
      } else {
        setUsernameStatus(data ? "taken" : "available");
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [username]);

  async function handleSubmit() {
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (usernameStatus === "taken") {
      setError("That username is already taken.");
      return;
    }

    setLoading(true);

    // Re-check right before submitting — the live check above can go
    // stale if someone else takes the name in the gap between typing
    // and hitting submit. profiles.username is UNIQUE in the DB
    // either way, so this is belt-and-suspenders, not the real
    // enforcement.
    const { data: existing, error: recheckError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (recheckError) {
      setLoading(false);
      setError("Couldn't verify that username right now. Please try again.");
      return;
    }
    if (existing) {
      setLoading(false);
      setUsernameStatus("taken");
      setError("That username is already taken.");
      return;
    }

    // In add-account mode, the account signing up isn't the only one
    // in play — snapshot whoever is currently active BEFORE signUp()
    // touches anything, same as the login path's useAddAccount, so
    // AuthCallback can save it alongside the new account once the
    // confirmation link is opened instead of silently losing it.
    if (addMode) {
      const { data: currentSessionData } = await supabase.auth.getSession();
      const previousSession = currentSessionData.session;
      if (previousSession) {
        const { data: previousProfile } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", previousSession.user.id)
          .single();
        if (previousProfile) {
          await setPendingAddAccount({
            user_id: previousProfile.id,
            username: previousProfile.username,
            display_name: previousProfile.display_name,
            avatar_url: previousProfile.avatar_url,
            access_token: previousSession.access_token,
            refresh_token: previousSession.refresh_token,
          });
        }
      }
    }

    // The handle_new_user() trigger (see 00_foundation.sql) automatically
    // creates the profile + wallet rows once this succeeds — we just
    // pass along username/display_name as user metadata for it to use.
    //
    // emailRedirectTo points the confirmation link at /auth/callback via
    // this app's own URL scheme, which waits for the SIGNED_IN event and
    // routes onward — see that screen for why we don't link straight to
    // a protected page.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName,
        },
        emailRedirectTo: Linking.createURL("/auth/callback"),
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(friendlySignUpError(signUpError.message));
      return;
    }

    // When "Confirm email" is on, Supabase doesn't return an explicit
    // error for a pre-existing email (to avoid leaking which emails
    // are registered) — instead it returns a user object with an
    // empty `identities` array. That's the documented signal for
    // "this email already has an account."
    if (signUpData.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
      setError("An account with this email already exists. Try logging in instead.");
      return;
    }

    // signUp() does not establish a session until the email is
    // confirmed — send the user to check their inbox for the link.
    router.push({ pathname: "/verify-email", params: { email } });
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
              Create another personal account. Your current account stays saved on this
              device — switch back to it anytime.
            </Text>
          )}

          <FormField
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="What people will see"
          />

          <View style={styles.usernameWrap}>
            <FormField
              label="Username"
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="yourname"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {usernameStatus === "checking" && (
              <Text style={[styles.usernameStatus, { color: colors.inkMuted }]}>
                Checking availability…
              </Text>
            )}
            {usernameStatus === "taken" && (
              <Text style={[styles.usernameStatus, { color: colors.danger }]}>
                That username is already taken.
              </Text>
            )}
            {usernameStatus === "available" && (
              <Text style={[styles.usernameStatus, { color: colors.accent }]}>
                Username is available.
              </Text>
            )}
          </View>

          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <PasswordField label="Password" value={password} onChangeText={setPassword} />

          {error ? (
            <Text style={[styles.errorText, { color: colors.danger }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button onPress={handleSubmit} disabled={loading} loading={loading}>
            Create account
          </Button>

          <View style={styles.loginRow}>
            <Text style={[styles.loginText, { color: colors.inkMuted }]}>
              Already have an account?{" "}
            </Text>
            <Link
              href={addMode ? "/login?add=1" : "/login"}
              style={[styles.loginLink, { color: colors.accent }]}
            >
              Log in
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
  // FormField already carries its own 24px bottom margin (see
  // components/FormField.tsx); the negative marginTop here tucks the
  // status line up close under the input, same as web's mt-1.5 reading
  // right below the field instead of after a full field-sized gap.
  usernameWrap: { marginTop: -14 },
  usernameStatus: { fontSize: 12, marginBottom: 10 },
  errorText: { fontSize: 14, marginBottom: 16 },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 24, flexWrap: "wrap" },
  loginText: { fontSize: 14 },
  loginLink: { fontSize: 14, fontWeight: "500" },
});

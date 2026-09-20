// File: screens/AuthCallbackScreen.tsx
// (routed to via app/auth/callback.tsx, which just re-exports this as
// the default)
//
// Ported from web's src/pages/auth/AuthCallback.tsx — this is what
// both the signup-confirmation and password-reset emails point at
// (see SignUpScreen's emailRedirectTo and ResetPasswordScreen's
// redirectTo, both built with Linking.createURL("/auth/callback")).
//
// The structural difference from web is unavoidable, not cosmetic:
// web's supabase-js runs in a browser, so with detectSessionInUrl left
// on it parses the confirmation URL itself and fires PASSWORD_RECOVERY
// or SIGNED_IN on onAuthStateChange without any help from AuthCallback
// beyond listening. Native's client has detectSessionInUrl: false (see
// lib/supabase.ts — there's no browser URL bar to read), so nothing
// parses the incoming deep link automatically. This screen has to:
//   1. capture the deep link itself (cold start via
//      Linking.getInitialURL(), warm start via the "url" event),
//   2. parse out whatever Supabase put in it, and
//   3. establish the session by hand before onAuthStateChange has
//      anything to say at all.
//
// FLAG — flow-type assumption: Supabase email links carry the session
// either as a `code` query param (PKCE — exchanged via
// exchangeCodeForSession) or as access_token/refresh_token in the URL
// fragment (implicit flow — passed to setSession directly). Which one
// your project's confirmation emails actually use depends on your
// Supabase Auth settings; this handles both so it works either way,
// but hasn't been tested against a real email link yet. Also confirm
// "ako://auth/callback" is registered to open this app (app.json's
// "scheme": "ako" already covers this — no config change needed) and,
// for a production build, that a Universal/App Link fallback exists
// for clients that don't have the app installed yet.
//
// Because native has no URL bar, the `type` param (recovery vs
// signup/magiclink) is read directly out of the parsed link rather
// than inferred from an auth event the way web's PASSWORD_RECOVERY
// check does — same information, just sourced differently.
import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { saveAccount, takePendingAddAccount } from "../lib/accountSessions";
import { useTheme } from "../lib/theme";
import { Wordmark } from "../components/Wordmark";
import { AuthPattern } from "../components/AuthPattern";
import { Button } from "../components/Button";

type Status = "waiting" | "error";

// Query params can arrive in the URL's search string or its fragment
// (`#...`) depending on which Supabase flow issued the link — merge
// both, fragment taking precedence, so the rest of this file doesn't
// need to care which one a given link used.
function parseCallbackUrl(url: string): Record<string, string> {
  const hashIndex = url.indexOf("#");
  const query: Record<string, string> = {};

  const parsed = Linking.parse(url);
  for (const [key, value] of Object.entries(parsed.queryParams ?? {})) {
    if (typeof value === "string") query[key] = value;
  }

  if (hashIndex !== -1) {
    const hashParams = new URLSearchParams(url.slice(hashIndex + 1));
    for (const [key, value] of hashParams.entries()) {
      query[key] = value;
    }
  }

  return query;
}

export function AuthCallbackScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [status, setStatus] = useState<Status>("waiting");

  useEffect(() => {
    let settled = false;

    async function finishSignIn(session: Session) {
      // Left behind by SignUpScreen when this confirmation completes a
      // sign-up started from "Add account" rather than a fresh,
      // signed-out one — see lib/accountSessions.ts. Save the account
      // that was active before, cache this new one too (so switching
      // back to it later doesn't need the password again), and
      // best-effort link them server-side, same as the login path's
      // add-account flow.
      const pending = await takePendingAddAccount();
      if (pending && pending.user_id !== session.user.id) {
        await saveAccount(pending);
        const { data: newProfile } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", session.user.id)
          .single();
        if (newProfile) {
          await saveAccount({
            user_id: newProfile.id,
            username: newProfile.username,
            display_name: newProfile.display_name,
            avatar_url: newProfile.avatar_url,
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
        }
        await supabase.rpc("link_accounts", { p_other_user_id: pending.user_id });
      }

      queryClient.clear();
      // New signups always start onboarding at Welcome. A returning
      // user completing a password-reset link (not signup) who
      // somehow reaches this branch still resolves correctly —
      // RequireAuth's own onboarding check will bounce /feed back to
      // whichever step is actually appropriate, so sending everyone to
      // Welcome here is safe rather than trying to branch on
      // "is this a signup or a reset" ourselves.
      router.replace("/onboarding/welcome");
    }

    async function handleUrl(url: string | null) {
      if (!url || settled) return;

      const params = parseCallbackUrl(url);

      // Supabase returns errors (expired/invalid link, already-used
      // link) as URL params rather than throwing.
      if (params.error) {
        settled = true;
        setStatus("error");
        return;
      }

      // Password-recovery links: send straight to ResetPasswordScreen
      // with the same signal web passed via router state.
      if (params.type === "recovery") {
        // A recovery link still needs its session established before
        // updateUser() (called from ResetPasswordScreen) will work.
        if (params.access_token && params.refresh_token) {
          await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
        } else if (params.code) {
          await supabase.auth.exchangeCodeForSession(params.code);
        }
        settled = true;
        router.replace({ pathname: "/reset-password", params: { fromRecovery: "1" } });
        return;
      }

      // Signup confirmation / magic link: establish the session, then
      // route onward the same way web's SIGNED_IN branch does.
      let session = null;
      if (params.access_token && params.refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (error) {
          settled = true;
          setStatus("error");
          return;
        }
        session = data.session;
      } else if (params.code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
        if (error) {
          settled = true;
          setStatus("error");
          return;
        }
        session = data.session;
      }

      if (session) {
        settled = true;
        await finishSignIn(session);
      }
    }

    // Cold start — app opened directly via the link.
    Linking.getInitialURL().then(handleUrl);

    // Warm start — app was already open in the background.
    const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));

    // Fallback: if no usable link data ever shows up (link already
    // consumed, malformed URL, etc.), stop showing a spinner forever.
    const timeout = setTimeout(() => {
      if (!settled) setStatus("error");
    }, 8000);

    return () => {
      subscription.remove();
      clearTimeout(timeout);
    };
  }, [router, queryClient]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.canvas }]}>
      <AuthPattern />
      <View style={styles.content}>
        <View style={styles.wordmarkWrap}>
          <Wordmark />
        </View>

        {status === "waiting" && (
          <Text style={[styles.waitingText, { color: colors.inkMuted }]}>
            Confirming your link…
          </Text>
        )}

        {status === "error" && (
          <>
            <Text style={[styles.heading, { color: colors.ink }]}>Link expired</Text>
            <Text style={[styles.subheading, { color: colors.inkMuted }]}>
              This link is invalid or has already been used. Request a new one below.
            </Text>
            <Button onPress={() => router.replace("/login")}>Back to log in</Button>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  wordmarkWrap: { marginBottom: 32 },
  waitingText: { fontSize: 14, textAlign: "center" },
  heading: { fontSize: 22, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  subheading: { fontSize: 14, marginBottom: 32, textAlign: "center" },
});

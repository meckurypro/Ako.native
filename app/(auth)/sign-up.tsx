import { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { AuthScreen } from "@/components/navigation/AuthScreen";
import { Button, Input, Text } from "@/components/core";
import { supabase } from "@/lib/supabase";
import { setPendingAddAccount } from "@/lib/account-sessions";
import { useAuth } from "@/providers/AuthProvider";
import { friendlyAuthError, isValidEmail, MIN_PASSWORD_LENGTH, MIN_USERNAME_LENGTH, normalizeUsername } from "@/features/auth/validation";
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "error";

export default function SignUp() {
  const router = useRouter(); const { signUp } = useAuth(); const usernameRef = useRef<TextInput>(null); const emailRef = useRef<TextInput>(null); const passwordRef = useRef<TextInput>(null); const confirmRef = useRef<TextInput>(null); const checkId = useRef(0);
  const { add } = useLocalSearchParams<{ add?: string }>(); const addMode = add === "1";
  const [displayName, setDisplayName] = useState(""); const [username, setUsername] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [status, setStatus] = useState<UsernameStatus>("idle"); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  useEffect(() => { if (username.length < MIN_USERNAME_LENGTH) return; const id = ++checkId.current; const timer = setTimeout(async () => { const { data, error: checkError } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle(); if (id !== checkId.current) return; setStatus(checkError ? "error" : data ? "taken" : "available"); }, 400); return () => clearTimeout(timer); }, [username]);
  const submit = async () => {
    setError(null); if (!displayName.trim()) { setError("Enter your display name."); return; } if (username.length < MIN_USERNAME_LENGTH) { setError("Username must be at least 3 characters."); return; } if (status === "taken") { setError("That username is already taken."); return; } if (status === "checking" || status === "error") { setError("Wait until we can verify your username."); return; } if (!isValidEmail(email)) { setError("Enter a valid email address."); return; } if (password.length < MIN_PASSWORD_LENGTH) { setError("Password must be at least 8 characters."); return; } if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { data: existing, error: checkError } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle(); if (checkError) throw checkError; if (existing) { setStatus("taken"); throw new Error("username duplicate"); }
      // In add-account mode, snapshot whoever is active BEFORE signUp()
      // touches anything, so the auth-callback screen can save it
      // alongside the new account once the confirmation link is opened.
      if (addMode) {
        const { data: currentSessionData } = await supabase.auth.getSession(); const previousSession = currentSessionData.session;
        if (previousSession) {
          const { data: previousProfile } = await supabase.from("profiles").select("id, username, display_name, avatar_url").eq("id", previousSession.user.id).single();
          if (previousProfile) await setPendingAddAccount({ user_id: previousProfile.id, username: previousProfile.username, display_name: previousProfile.display_name, avatar_url: previousProfile.avatar_url, access_token: previousSession.access_token, refresh_token: previousSession.refresh_token });
        }
      }
      await signUp({ email, password, username, displayName });
      router.replace({ pathname: "/(auth)/verify-email", params: { email } });
    } catch (err) { setError(friendlyAuthError(err, "Couldn't create your account. Please try again.")); } finally { setLoading(false); }
  };
  const usernameHint = status === "checking" ? "Checking availability…" : status === "available" ? "Username is available." : status === "error" ? "Couldn't check right now." : "Lowercase letters, numbers and underscores.";
  return <AuthScreen title={addMode ? "Add an account" : "Create your AKọ"} subtitle={addMode ? "Create another personal account. Your current account stays saved on this device — switch back to it anytime." : "Use the same account on web and mobile."}><View style={{ gap: 15 }}><Input label="Display name" value={displayName} onChangeText={setDisplayName} autoComplete="name" returnKeyType="next" onSubmitEditing={() => usernameRef.current?.focus()} /><Input ref={usernameRef} label="Username" value={username} onChangeText={(value) => { const normalized = normalizeUsername(value); setUsername(normalized); checkId.current += 1; setStatus(normalized.length >= MIN_USERNAME_LENGTH ? "checking" : "idle"); }} autoCapitalize="none" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} hint={usernameHint} error={status === "taken" ? "That username is already taken." : null} /><Input ref={emailRef} label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} /><Input ref={passwordRef} label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" returnKeyType="next" onSubmitEditing={() => confirmRef.current?.focus()} hint="At least 8 characters." /><Input ref={confirmRef} label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" returnKeyType="done" onSubmitEditing={() => void submit()} />{error && <Text variant="caption" color="danger" accessibilityRole="alert">{error}</Text>}<Button label="Create account" loading={loading} onPress={() => void submit()} /></View>{!addMode && <Text variant="caption" color="secondary" align="center">Already have an account? <Link href="/(auth)/sign-in" style={{ color: "#3D5A45", fontWeight: "700" }}>Sign in</Link></Text>}</AuthScreen>;
}

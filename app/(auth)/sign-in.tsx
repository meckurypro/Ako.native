import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { AuthScreen } from "@/components/navigation/AuthScreen";
import { Button, Input, Text } from "@/components/core";
import { useAuth } from "@/providers/AuthProvider";
import { useAddAccount } from "@/features/account/switcher";
import { friendlyAuthError, isValidEmail } from "@/features/auth/validation";

export default function SignIn() {
  const passwordRef = useRef<TextInput>(null); const { signIn, resendVerification } = useAuth(); const router = useRouter();
  const { add } = useLocalSearchParams<{ add?: string }>(); const addMode = add === "1";
  const addAccount = useAddAccount();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string | null>(null); const [unconfirmed, setUnconfirmed] = useState(false); const [loading, setLoading] = useState(false); const [resent, setResent] = useState(false);
  const submit = async () => { if (!isValidEmail(email)) { setError("Enter a valid email address."); return; } if (!password) { setError("Enter your password."); return; } setLoading(true); setError(null); setUnconfirmed(false);
    if (addMode) {
      try { const newProfile = await addAccount.mutateAsync({ email, password }); router.replace({ pathname: "/profiles/[username]", params: { username: newProfile.username } }); }
      catch (err) { setError(friendlyAuthError(err, "Incorrect email or password.")); }
      finally { setLoading(false); }
      return;
    }
    try { await signIn(email, password); } catch (err) { const message = friendlyAuthError(err, "Incorrect email or password."); setError(message); setUnconfirmed(message.toLowerCase().includes("confirm")); } finally { setLoading(false); } };
  const resend = async () => { setLoading(true); setError(null); try { await resendVerification(email); setResent(true); } catch (err) { setError(friendlyAuthError(err, "Couldn't resend the link. Try again shortly.")); } finally { setLoading(false); } };
  return <AuthScreen title={addMode ? "Add an account" : "Welcome back"} subtitle={addMode ? "Sign in to another AKọ account on this device." : "Sign in to continue to your AKọ."}><View style={{ gap: 16 }}><Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} /><Input ref={passwordRef} label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" returnKeyType="done" onSubmitEditing={() => void submit()} />{error && <Text variant="caption" color="danger" accessibilityRole="alert">{error}</Text>}{!addMode && unconfirmed && <Button label={resent ? "Confirmation sent" : "Resend confirmation"} variant="ghost" disabled={resent} onPress={() => void resend()} />}<Button label={addMode ? "Add account" : "Sign in"} loading={loading} onPress={() => void submit()} />{!addMode && <Link href="/(auth)/forgot-password" asChild><Button label="Forgot password?" variant="ghost" /></Link>}{addMode ? <Link href={{ pathname: "/(auth)/sign-up", params: { add: "1" } }} asChild><Button label="Create another account instead" variant="ghost" /></Link> : null}</View>{!addMode && <Text variant="caption" color="secondary" align="center">New to AKọ? <Link href="/(auth)/sign-up" style={{ color: "#3D5A45", fontWeight: "700" }}>Create an account</Link></Text>}</AuthScreen>;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { AppState } from "react-native";
import { queryClient } from "@/lib/query-client";
import { reconcileLocalDataOwner } from "@/lib/local-data";
import { unregisterPushToken } from "@/features/notifications/pushToken";
import { supabase } from "@/lib/supabase";

export type AuthProfile = { username: string; display_name: string; bio: string | null; avatar_url: string | null; onboarding_completed: boolean };
type SignUpInput = { email: string; password: string; username: string; displayName: string };
type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  isReady: boolean;
  onboardingComplete: boolean;
  isRecovery: boolean;
  sessionExpired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const requestInFlight = useRef(false);
  const manualSignOut = useRef(false);
  const hadSession = useRef(false);
  const lastUserId = useRef<string | null>(null);
  const localDataChecked = useRef(false);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("username, display_name, bio, avatar_url, onboarding_completed").eq("id", userId).maybeSingle();
    if (error) throw error;
    setProfile(data);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user.id) await loadProfile(session.user.id);
  }, [loadProfile, session]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return;
      if (error) { setSessionExpired(true); await supabase.auth.signOut({ scope: "local" }); }
      const nextSession = error ? null : data.session;
      setSession(nextSession);
      if (nextSession) lastUserId.current = nextSession.user.id;
      if (nextSession) {
        try { await loadProfile(nextSession.user.id); } catch { setProfile(null); }
      }
      if (mounted) setIsReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      // A different account taking over the session (account switch, or signing in as someone else
      // without a SIGNED_OUT in between) must never see the previous account's in-memory cache.
      const nextUserId = nextSession?.user.id ?? null;
      if (nextUserId && lastUserId.current && lastUserId.current !== nextUserId) queryClient.clear();
      if (nextUserId) lastUserId.current = nextUserId;
      setSession(nextSession);
      if (nextSession) hadSession.current = true;
      if (event === "SIGNED_OUT" && hadSession.current && !manualSignOut.current) setSessionExpired(true);
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setSessionExpired(false);
        if (AppState.currentState === "active") supabase.auth.startAutoRefresh();
      }
      if (!nextSession) {
        setProfile(null);
        lastUserId.current = null;
        queryClient.clear();
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void loadProfile(nextSession.user.id).catch(() => setProfile(null));
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [loadProfile]);

  // On-device caches (SQLite + the persisted query cache) belong to one user. Once auth has resolved,
  // and on every change of user id, make sure they are that user's — or wiped. Keyed on the id, not
  // on SIGNED_OUT, because account switches go through setSession and never fire SIGNED_OUT.
  // The outbox is user-scoped rather than wiped, so unsent items survive (lib/outbox.ts).
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!isReady) return;
    const cold = !localDataChecked.current;
    localDataChecked.current = true;
    void reconcileLocalDataOwner(userId, { treatUnownedAsStale: cold }).then((wiped) => {
      // In-memory clearing for sign-out/switch already happens above; the cold-start case is the
      // one where a stale persisted cache was hydrated into memory before we knew whose it was.
      if (wiped && cold) queryClient.clear();
    });
  }, [isReady, userId]);

  const runExclusive = useCallback(async <T,>(request: () => Promise<T>): Promise<T> => {
    if (requestInFlight.current) throw new Error("An authentication request is already in progress.");
    requestInFlight.current = true;
    try { return await request(); } finally { requestInFlight.current = false; }
  }, []);

  const signIn = useCallback((email: string, password: string) => runExclusive(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }), [runExclusive]);

  const signUp = useCallback((input: SignUpInput) => runExclusive(async () => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(), password: input.password,
      options: { data: { username: input.username, display_name: input.displayName.trim() }, emailRedirectTo: Linking.createURL("auth/callback") },
    });
    if (error) throw error;
    if (data.user?.identities?.length === 0) throw new Error("already registered");
  }), [runExclusive]);

  const resendVerification = useCallback((email: string) => runExclusive(async () => {
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: Linking.createURL("auth/callback") } });
    if (error) throw error;
  }), [runExclusive]);

  const requestPasswordReset = useCallback((email: string) => runExclusive(async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: Linking.createURL("auth/callback") });
    if (error) throw error;
  }), [runExclusive]);

  const updatePassword = useCallback((password: string) => runExclusive(async () => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setIsRecovery(false);
  }), [runExclusive]);

  const signOut = useCallback(async () => {
    manualSignOut.current = true;
    // While the session is still valid: hand this device's push token back so the next account on it
    // can register cleanly (and this one stops receiving pushes it can no longer open).
    await unregisterPushToken();
    const { error } = await supabase.auth.signOut();
    supabase.auth.stopAutoRefresh();
    setIsRecovery(false);
    queryClient.clear();
    hadSession.current = false;
    manualSignOut.current = false;
    if (error) throw error;
  }, []);

  const value = useMemo<AuthValue>(() => ({
    session, user: session?.user ?? null, profile, isReady,
    onboardingComplete: profile?.onboarding_completed === true, isRecovery, sessionExpired,
    signIn, signUp, resendVerification, requestPasswordReset, updatePassword, signOut, refreshProfile,
  }), [session, profile, isReady, isRecovery, sessionExpired, signIn, signUp, resendVerification, requestPasswordReset, updatePassword, signOut, refreshProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

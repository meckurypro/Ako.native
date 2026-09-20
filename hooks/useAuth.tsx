// File: hooks/useAuth.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native"; // native replacement for document.visibilitychange
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { updateSavedAccountTokens } from "../lib/accountSessions"; // now converted — see lib/accountSessions.ts

interface MyProfile {
  username: string;
  avatar_url: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: MyProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // updateSavedAccountTokens is now async (AsyncStorage) — fire-and-forget
      // here matches the web version's intent (best-effort background sync,
      // nothing downstream awaits this), but errors are swallowed silently.
      // Worth adding a .catch(console.error) once this is being tested for real.
      if (session) {
        updateSavedAccountTokens(session.user.id, {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime notification sync — unchanged from web, Supabase's realtime
  // client works the same over native WebSockets.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
          if (payload.new.type === "message") {
            queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
            const conversationId = payload.new.target_id as string | undefined;
            if (conversationId) {
              queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, queryClient]);

  // Presence heartbeat. Web version used setInterval + a
  // document.visibilitychange listener (touch on tab focus). Native
  // equivalent: AppState — fires when the app moves between
  // active/background/inactive, which is the mobile analog of tab
  // focus/blur.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const touch = () => {
      supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", userId)
        .then(({ error }) => {
          if (error) console.error("Failed to update last_seen_at:", error);
        });
    };

    touch();
    const interval = setInterval(touch, 45_000);

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") touch();
    };
    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [session?.user?.id]);

  const userId = session?.user?.id;

  const { data: profile } = useQuery({
    queryKey: ["my-username", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: Infinity,
  });

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile: profile ?? null, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

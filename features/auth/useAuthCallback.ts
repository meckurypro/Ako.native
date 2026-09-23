import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import { saveAccount, takePendingAddAccount } from "@/lib/account-sessions";

export type CallbackStatus = "waiting" | "success" | "recovery" | "error";

export function useAuthCallback() {
  const url = Linking.useURL();
  const [status, setStatus] = useState<CallbackStatus>("waiting");
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let active = true;
    const process = async () => {
      try {
        const parsedUrl = new URL(url);
        const hash = new URLSearchParams(parsedUrl.hash.replace(/^#/, ""));
        const read = (key: string) => parsedUrl.searchParams.get(key) ?? hash.get(key);
        if (read("error")) throw new Error(read("error_description") ?? "This link is invalid or has expired.");
        const code = read("code");
        const accessToken = read("access_token");
        const refreshToken = read("refresh_token");
        const type = read("type");
        let error: Error | null = null;
        let session: { user: { id: string }; access_token: string; refresh_token: string } | null = null;
        if (code) { const result = await supabase.auth.exchangeCodeForSession(code); error = result.error; session = result.data.session; }
        else if (accessToken && refreshToken) { const result = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }); error = result.error; session = result.data.session; }
        else throw new Error("This link is malformed or has already been used.");
        if (error) throw error;

        // Left behind by sign-up.tsx if this confirmation completes a
        // sign-up started from "Add account" rather than a fresh,
        // signed-out one — save both accounts and best-effort link them
        // server-side, same as the sign-in-path add-account flow.
        if (session && type !== "recovery") {
          const pending = await takePendingAddAccount();
          if (pending && pending.user_id !== session.user.id) {
            await saveAccount(pending);
            const { data: newProfile } = await supabase.from("profiles").select("id, username, display_name, avatar_url").eq("id", session.user.id).single();
            if (newProfile) {
              await saveAccount({ user_id: newProfile.id, username: newProfile.username, display_name: newProfile.display_name, avatar_url: newProfile.avatar_url, access_token: session.access_token, refresh_token: session.refresh_token });
            }
            await supabase.rpc("link_accounts", { p_other_user_id: pending.user_id });
          }
        }

        if (active) setStatus(type === "recovery" ? "recovery" : "success");
      } catch (error) {
        if (active) { setStatus("error"); setMessage(error instanceof Error ? error.message : "This link is invalid or has expired."); }
      }
    };
    void process();
    return () => { active = false; };
  }, [url]);
  return { status, message };
}

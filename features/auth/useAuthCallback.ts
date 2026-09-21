import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";

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
        if (code) ({ error } = await supabase.auth.exchangeCodeForSession(code));
        else if (accessToken && refreshToken) ({ error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }));
        else throw new Error("This link is malformed or has already been used.");
        if (error) throw error;
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

// File: lib/supabase.ts
import "react-native-url-polyfill/auto"; // FLAG: required — Supabase's client assumes URL/URLSearchParams exist; RN doesn't have them natively. Install with: npx expo install react-native-url-polyfill
import AsyncStorage from "@react-native-async-storage/async-storage"; // FLAG: install with: npx expo install @react-native-async-storage/async-storage
import { createClient } from "@supabase/supabase-js";

// Web read these from import.meta.env (Vite). Expo uses process.env with
// the EXPO_PUBLIC_ prefix instead — env vars must be prefixed this way
// to be exposed to the app bundle at all. Set these in a .env file at
// the project root (gitignored) or as EAS build secrets.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file."
  );
}

// The core native-specific change: web's Supabase client defaults to
// localStorage for session persistence, which doesn't exist on native.
// AsyncStorage is the RN equivalent — without this block, users get
// logged out every time the app restarts.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // web-only concern (magic link URL parsing) — not applicable on native
  },
});

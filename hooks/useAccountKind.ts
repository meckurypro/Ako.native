// File: hooks/useAccountKind.ts
// Direct port of web's src/hooks/useAccountKind.ts — no native-specific
// changes, Supabase query logic is identical on both platforms.
//
// A username on its own doesn't say whether it belongs to a personal
// profile (/profile/:username) or an organization/brand page
// (/page/:username) — rendering an @mention back out needs to know
// which. Checks profiles first since that's the overwhelmingly common
// case, only falling through to pages if no profile owns that username.
//
// Defaults to "profile" while loading and for a username that matches
// neither (a stale mention on a renamed/deleted account) — an
// unresolved or dead handle degrades to the same harmless 404 it always
// would have, never a crash.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export function useAccountKind(username: string) {
  return useQuery({
    queryKey: ["account-kind", username],
    queryFn: async (): Promise<"profile" | "page"> => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .eq("is_deleted", false)
        .maybeSingle();
      return profile ? "profile" : "page";
    },
    staleTime: 30 * 60 * 1000,
  });
}

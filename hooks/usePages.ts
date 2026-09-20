// File: hooks/usePages.ts
//
// Only useActiveIdentity so far (the Bottom Nav needs to know whether
// we're acting as a page). The rest of web's usePages.ts (page by
// username, members, invites, useSwitchActiveMode) ports with Pages.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { ActiveIdentity } from "../types/database";

export const PAGE_SELECT =
  "id, page_type, name, username, tagline, bio, avatar_url, cover_url, website_url, category_id, parent_organization_id, created_by, is_verified, is_active, follower_count, created_at, updated_at";

/**
 * The identity the signed-in user is currently acting as — personal, or
 * one of their pages plus their role on it.
 */
export function useActiveIdentity() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["active-identity", user?.id],
    // Same as web: always await a real round-trip on mount so a stale
    // snapshot can't send someone to the wrong profile (personal vs page).
    refetchOnMount: "always",
    queryFn: async (): Promise<ActiveIdentity> => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("active_page_id")
        .eq("id", user!.id)
        .single();
      if (error) throw error;

      if (!profile.active_page_id) return { mode: "personal" };

      const { data: membership, error: memberError } = await supabase
        .from("page_members")
        .select(`role_label, is_admin, page:pages(${PAGE_SELECT})`)
        .eq("page_id", profile.active_page_id)
        .eq("user_id", user!.id)
        .eq("status", "active")
        .maybeSingle();
      if (memberError) throw memberError;

      // Membership vanished (removed / page deactivated) — fall back to
      // personal rather than error out.
      if (!membership || !membership.page) return { mode: "personal" };

      return {
        mode: "page",
        page: membership.page as any,
        role_label: membership.role_label,
        is_admin: membership.is_admin,
      };
    },
    enabled: !!user,
  });
}

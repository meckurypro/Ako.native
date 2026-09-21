// File: features/feed/postExtras.ts
//
// Data hooks the PostCard needs that features/feed/api.ts doesn't have yet.
// Query bodies and keys are web's (src/hooks/useCollaboration.ts,
// useAccountKind.ts, usePosts.ts, useProfileVisits.ts, useReactions.ts), kept
// in their own file so api.ts stays untouched.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { useActiveIdentity } from "@/features/compose/api";

// ─── Collaborators ─────────────────────────────────────────────────────────
export type CollaborationStatus = "invited" | "accepted" | "declined" | "removed";
export type Collaborator = {
  status: CollaborationStatus;
  user: { id: string; username: string; display_name: string; avatar_url: string | null };
};

/** Everyone invited/collaborating on a post, accepted-first (web's useCollaborators("post", id)). */
export function useCollaborators(postId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["collaborators", "post", postId],
    enabled: !!postId && enabled,
    queryFn: async (): Promise<Collaborator[]> => {
      const { data, error } = await supabase
        .from("post_collaborators")
        .select("status, user:profiles!post_collaborators_user_id_fkey(id, username, display_name, avatar_url)")
        .eq("post_id", postId!)
        .neq("status", "removed")
        .order("status", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Collaborator[];
    },
  });
}

// ─── @mention targets ──────────────────────────────────────────────────────
/**
 * A username alone doesn't say whether it belongs to a personal profile or an
 * organization/brand page. Checks profiles first (the overwhelmingly common
 * case); defaults to "profile" while loading and for handles that match
 * neither. Cached long and shared across every mention of the same handle.
 */
export function useAccountKind(username: string) {
  return useQuery({
    queryKey: ["account-kind", username],
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<"profile" | "page"> => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .eq("is_deleted", false)
        .maybeSingle();
      return profile ? "profile" : "page";
    },
  });
}

// ─── Reshare / prioritize state ────────────────────────────────────────────
/** Whether the current user has already reshared/quoted the post (you can only reshare a given post once). */
export function useHasReshared(postId: string, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["has-reshared", postId, user?.id],
    enabled: !!user && enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("id")
        .eq("author_id", user!.id)
        .eq("reshared_post_id", postId)
        .eq("is_deleted", false)
        .maybeSingle();
      return !!data;
    },
  });
}

/** The creator's post prioritized today (or null) — drives the "Prioritized today" state. */
export function usePrioritizedPostToday(creatorId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["prioritized-post-today", creatorId],
    enabled: !!creatorId && enabled,
    queryFn: async (): Promise<string | null> => {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, matches the edge function
      const { data, error } = await supabase
        .from("prioritized_posts")
        .select("post_id")
        .eq("creator_id", creatorId!)
        .eq("prioritized_date", today)
        .maybeSingle();
      if (error) throw error;
      return data?.post_id ?? null;
    },
  });
}

// ─── Analytics / usage signals ─────────────────────────────────────────────
/**
 * Logs that `visitorId` reached `visitedProfileId`'s profile via a post's byline
 * (one row per post+visitor; the DB keeps posts.profile_visit_count in sync).
 * Fire-and-forget. Only call for a profile destination — a byline that routes
 * to a page isn't a profile visit.
 */
export function recordProfileVisitFromPost(postId: string, visitedProfileId: string, visitorId: string): void {
  if (visitorId === visitedProfileId) return;
  supabase
    .from("post_profile_visits")
    .upsert(
      { post_id: postId, visited_profile_id: visitedProfileId, visitor_id: visitorId },
      { onConflict: "post_id,visitor_id", ignoreDuplicates: true }
    )
    .then(({ error }) => {
      if (error) console.error("Failed to record post-sourced profile visit:", error.message);
    });
}

/**
 * Records a completed share as a "share" reaction (same row web's
 * useToggleReaction(post, "share") writes). It is also the usage signal
 * useEngagementOrder ranks Share by. Insert-only: a repeat share hits the
 * unique constraint (23505), which is fine.
 */
export function useRecordShare(postId: string) {
  const { user } = useAuth();
  const identity = useActiveIdentity();
  const client = useQueryClient();
  const pageId = identity.data?.mode === "page" ? identity.data.page.id : null;
  return useMutation({
    mutationFn: async () => {
      if (!user || identity.isLoading) return;
      const { error } = await supabase
        .from("reactions")
        .insert({ post_id: postId, user_id: user.id, type: "share", target_type: "post", acted_as_page_id: pageId });
      if (error && error.code !== "23505") throw error;
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["post", postId] });
      void client.invalidateQueries({ queryKey: ["engagement-order"] });
    },
  });
}

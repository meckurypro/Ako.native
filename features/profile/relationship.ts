// File: features/profile/relationship.ts
//
// Relationship/safety actions for viewing someone else's profile —
// block, mute, remove-follower, contact nicknames, profile-visit
// tracking, and reporting. Ports web's usePrivacy.ts,
// useContactNicknames.ts, useProfileVisits.ts and useReports.ts onto
// the same Supabase tables (same backend, same RLS), in native's
// consolidated-hook style so ShareProfileSheet/ProfileToolbar can stay
// thin.
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

function notSelf(userId?: string, targetId?: string) {
  return !!userId && !!targetId && userId !== targetId;
}

export function useIsBlocked(targetId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-blocked", targetId, user?.id],
    enabled: notSelf(user?.id, targetId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_users")
        .select("blocker_id")
        .eq("blocker_id", user!.id)
        .eq("blocked_id", targetId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export function useToggleBlock(targetId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (currentlyBlocked: boolean) => {
      if (!user) throw new Error("Not signed in");
      const { error } = currentlyBlocked
        ? await supabase.from("blocked_users").delete().eq("blocker_id", user.id).eq("blocked_id", targetId)
        : await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: targetId });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["is-blocked", targetId] });
      void qc.invalidateQueries({ queryKey: ["follow-state", targetId] });
      void qc.invalidateQueries({ queryKey: ["identity-posts"] });
      void qc.invalidateQueries({ queryKey: ["profile-media", targetId] });
    },
  });
}

export function useIsMuted(targetId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-muted", targetId, user?.id],
    enabled: notSelf(user?.id, targetId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("muted_users")
        .select("muter_id")
        .eq("muter_id", user!.id)
        .eq("muted_id", targetId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export function useToggleMute(targetId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (currentlyMuted: boolean) => {
      if (!user) throw new Error("Not signed in");
      const { error } = currentlyMuted
        ? await supabase.from("muted_users").delete().eq("muter_id", user.id).eq("muted_id", targetId)
        : await supabase.from("muted_users").insert({ muter_id: user.id, muted_id: targetId });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["is-muted", targetId] }),
  });
}

/**
 * Removes someone who follows ME from my followers — deletes their
 * follows row (follower_id = them, following_id = me). Mirrors web's
 * useRemoveFollower, which needs its own RLS carve-out distinct from
 * the plain unfollow policy (see 32_remove_follower.sql).
 */
export function useRemoveFollower(targetId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", targetId)
        .eq("following_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["follow-state", targetId] });
      void qc.invalidateQueries({ queryKey: ["connections"] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/** A private label the signed-in user has set for someone else — visible only to them. */
export function useContactNickname(contactId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["contact-nickname", contactId, user?.id],
    enabled: notSelf(user?.id, contactId),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("contact_nicknames")
        .select("nickname")
        .eq("owner_id", user!.id)
        .eq("contact_id", contactId)
        .maybeSingle();
      if (error) throw error;
      return data?.nickname ?? null;
    },
  });
}

export function useSetContactNickname(contactId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nickname: string) => {
      if (!user) throw new Error("Not signed in");
      const trimmed = nickname.trim();
      if (!trimmed) {
        const { error } = await supabase
          .from("contact_nicknames")
          .delete()
          .eq("owner_id", user.id)
          .eq("contact_id", contactId);
        if (error) throw error;
        return null;
      }
      const { error } = await supabase
        .from("contact_nicknames")
        .upsert(
          { owner_id: user.id, contact_id: contactId, nickname: trimmed, updated_at: new Date().toISOString() },
          { onConflict: "owner_id,contact_id" }
        );
      if (error) throw error;
      return trimmed;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["contact-nickname", contactId] }),
  });
}

/**
 * Records that the signed-in user visited profileId's profile.
 * No-ops while signed out, before the profile has loaded, and for
 * self-visits — mirrors web's useRecordProfileVisit. Fire-and-forget:
 * a failure here shouldn't surface to the viewer.
 */
export function useRecordProfileVisit(profileId: string | undefined) {
  const { user } = useAuth();
  useEffect(() => {
    if (!user || !profileId || user.id === profileId) return;
    void supabase
      .from("profile_visits")
      .upsert(
        { visited_id: profileId, visitor_id: user.id, visited_at: new Date().toISOString() },
        { onConflict: "visited_id,visitor_id" }
      )
      .then(({ error }) => {
        if (error) console.error("Failed to record profile visit:", error.message);
      });
  }, [user, profileId]);
}

export interface ReportReason {
  id: string;
  label: string;
  description: string | null;
}

/** Active reasons a reporter can pick from — same table the admin reasons screen manages. */
export function useReportReasons() {
  return useQuery({
    queryKey: ["report-reasons"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ReportReason[]> => {
      const { data, error } = await supabase
        .from("report_reasons")
        .select("id, label, description")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface SubmitReportInput {
  targetType: "profile" | "post" | "comment" | "project";
  targetId: string;
  reasonId: string;
  details?: string;
}

/** Files into the same reports queue the admin/moderation side already reads from. */
export function useSubmitReport() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: SubmitReportInput) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        target_type: input.targetType,
        target_id: input.targetId,
        reason_id: input.reasonId,
        details: input.details?.trim() || null,
      });
      if (error) throw error;
    },
  });
}

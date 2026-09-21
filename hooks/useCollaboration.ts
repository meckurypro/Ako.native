// File: hooks/useCollaboration.ts
//
// Read-only slice of web's src/hooks/useCollaboration.ts: the types and
// useCollaborators (who is invited/collaborating on a post or project). Query
// body and key are identical to web. PostCard uses it for the avatar badge and
// to lock editing on a post that credits an accepted collaborator.
//
// Not ported yet (invite flow — port with the Collaborators sheet / inbox):
//   useSendCollaborationRequest, useMyPendingCollaborationInvites (+ the
//   PendingPost/ProjectCollaborationInvite types), useRespondToCollaborationRequest,
//   useRemoveCollaborator.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export type CollaborationTarget = "post" | "project";
export type CollaborationStatus = "invited" | "accepted" | "declined" | "removed";

export interface Collaborator {
  status: CollaborationStatus;
  invited_at: string;
  responded_at: string | null;
  invited_by: string;
  user: { id: string; username: string; display_name: string; avatar_url: string | null };
  // Project-only — what this person is credited as contributing (e.g.
  // "Cinematographer"). Null for post collaborators, or when no role
  // was assigned on invite.
  role_label: string | null;
}

function tableFor(target: CollaborationTarget) {
  return target === "post" ? "post_collaborators" : "project_collaborators";
}
function idColumnFor(target: CollaborationTarget) {
  return target === "post" ? "post_id" : "project_id";
}

/** Everyone invited/collaborating on a given post or project, accepted-first. */
export function useCollaborators(target: CollaborationTarget, targetId: string | undefined) {
  return useQuery({
    queryKey: ["collaborators", target, targetId],
    queryFn: async (): Promise<Collaborator[]> => {
      if (!targetId) return [];
      const roleSelect = target === "project" ? ", role:gig_roles(label)" : "";
      const { data, error } = await supabase
        .from(tableFor(target))
        .select(
          `status, invited_at, responded_at, invited_by, user:profiles!${tableFor(target)}_user_id_fkey(id, username, display_name, avatar_url)${roleSelect}`
        )
        .eq(idColumnFor(target), targetId)
        .neq("status", "removed")
        .order("status", { ascending: true }); // "accepted" < "declined" < "invited" alphabetically — good enough default grouping
      if (error) throw error;
      return (data as any[]).map((row) => ({
        ...row,
        role_label: (Array.isArray(row.role) ? row.role[0] : row.role)?.label ?? null,
      })) as Collaborator[];
    },
    enabled: !!targetId,
  });
}

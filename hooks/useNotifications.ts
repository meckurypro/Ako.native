// File: hooks/useNotifications.ts
//
// Only the list query + unread count so far (what the bell badge needs).
// Mark-read / mark-all-read mutations port with the Notifications screen.
//
// Realtime for this query is handled globally by AuthProvider (it
// invalidates ["notifications", userId] on every INSERT) — do NOT add a
// second subscription here: supabase-js dedupes channels by topic, and
// adding `.on()` to an already-subscribed channel throws.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export interface NotificationWithActor {
  id: string;
  type: string;
  actor_id: string | null;
  target_type: string | null;
  target_id: string | null;
  preview_text: string | null;
  read_at: string | null;
  created_at: string;
  actor: { username: string; display_name: string; avatar_url: string | null } | null;
  // Only for target_type === "comment" — resolved by a second query
  // (target_id isn't a real FK). null = couldn't resolve (deleted).
  comment_post_id?: string | null;
  // Only for target_type === "project" — decides which dedicated page
  // (rooms/courses/books/meetings) the notification should route to.
  project_type?: string | null;
}

export function useNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async (): Promise<NotificationWithActor[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select(`*, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url)`)
        .eq("user_id", user.id)
        // Message notifications surface via the Messages tab badge, not
        // the bell — exclude them so they aren't double-counted.
        .neq("type", "message")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      const notifications = data as unknown as NotificationWithActor[];

      const commentIds = Array.from(
        new Set(
          notifications
            .filter((n) => n.target_type === "comment" && n.target_id)
            .map((n) => n.target_id as string)
        )
      );

      if (commentIds.length > 0) {
        const { data: commentRows, error: commentsError } = await supabase
          .from("comments")
          .select("id, post_id")
          .in("id", commentIds);
        if (commentsError) throw commentsError;

        const postIdByCommentId = new Map(
          (commentRows ?? []).map((c: any) => [c.id as string, c.post_id as string])
        );

        for (const n of notifications) {
          if (n.target_type === "comment" && n.target_id) {
            n.comment_post_id = postIdByCommentId.get(n.target_id) ?? null;
          }
        }
      }

      const projectIds = Array.from(
        new Set(
          notifications
            .filter((n) => n.target_type === "project" && n.target_id)
            .map((n) => n.target_id as string)
        )
      );

      if (projectIds.length > 0) {
        const { data: projectRows, error: projectsError } = await supabase
          .from("projects")
          .select("id, project_type")
          .in("id", projectIds);
        if (projectsError) throw projectsError;

        const typeByProjectId = new Map(
          (projectRows ?? []).map((p: any) => [p.id as string, p.project_type as string])
        );

        for (const n of notifications) {
          if (n.target_type === "project" && n.target_id) {
            n.project_type = typeByProjectId.get(n.target_id) ?? null;
          }
        }
      }

      return notifications;
    },
    enabled: !!user,
    // Safety net in case the realtime socket drops.
    refetchInterval: 2 * 60_000,
  });
}

export function useUnreadCount() {
  const { data: notifications } = useNotifications();
  return notifications?.filter((n) => !n.read_at).length ?? 0;
}

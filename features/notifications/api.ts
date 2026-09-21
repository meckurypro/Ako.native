import { useEffect, useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

export type NotificationActor = { username: string; display_name: string; avatar_url: string | null };
export type AppNotification = { id: string; type: string; actor_id: string | null; target_type: string | null; target_id: string | null; preview_text: string | null; read_at: string | null; created_at: string; actor: NotificationActor | null; comment_post_id?: string | null; project_type?: string | null };

async function enrichNotifications(rows: AppNotification[]) {
  const commentIds = [...new Set(rows.filter((row) => row.target_type === "comment" && row.target_id).map((row) => row.target_id!))];
  if (commentIds.length) {
    const { data, error } = await supabase.from("comments").select("id, post_id").in("id", commentIds);
    if (error) throw error;
    const postIds = new Map((data ?? []).map((row) => [row.id, row.post_id]));
    rows.forEach((row) => { if (row.target_type === "comment" && row.target_id) row.comment_post_id = postIds.get(row.target_id) ?? null; });
  }
  const projectIds = [...new Set(rows.filter((row) => row.target_type === "project" && row.target_id).map((row) => row.target_id!))];
  if (projectIds.length) {
    const { data, error } = await supabase.from("projects").select("id, project_type").in("id", projectIds);
    if (error) throw error;
    const types = new Map((data ?? []).map((row) => [row.id, row.project_type]));
    rows.forEach((row) => { if (row.target_type === "project" && row.target_id) row.project_type = types.get(row.target_id) ?? null; });
  }
  return rows;
}

export function usePersonalNotifications(enabled = true) {
  const { user } = useAuth(); const queryClient = useQueryClient(); const channelId = useId();
  useEffect(() => {
    if (!user || !enabled) return;
    const channel = supabase.channel(`mobile-notifications:${user.id}:${channelId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => void queryClient.invalidateQueries({ queryKey: ["mobile-notifications", user.id] })).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [channelId, enabled, queryClient, user]);
  return useQuery({ queryKey: ["mobile-notifications", user?.id], enabled: !!user && enabled, queryFn: async () => { const { data, error } = await supabase.from("notifications").select("*, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url)").eq("user_id", user!.id).neq("type", "message").order("created_at", { ascending: false }).limit(50); if (error) throw error; return enrichNotifications((data ?? []) as unknown as AppNotification[]); }, refetchInterval: 120_000 });
}

export function usePageNotifications(pageId?: string, enabled = true) {
  const queryClient = useQueryClient(); const channelId = useId();
  useEffect(() => {
    if (!pageId || !enabled) return;
    const channel = supabase.channel(`mobile-page-notifications:${pageId}:${channelId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "page_notifications", filter: `page_id=eq.${pageId}` }, () => void queryClient.invalidateQueries({ queryKey: ["mobile-page-notifications", pageId] })).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [channelId, enabled, pageId, queryClient]);
  return useQuery({ queryKey: ["mobile-page-notifications", pageId], enabled: !!pageId && enabled, queryFn: async () => { const { data, error } = await supabase.from("page_notifications").select("*, actor:profiles!page_notifications_actor_id_fkey(username, display_name, avatar_url)").eq("page_id", pageId!).order("created_at", { ascending: false }).limit(50); if (error) throw error; return enrichNotifications((data ?? []) as unknown as AppNotification[]); }, refetchInterval: 120_000 });
}

export function useMarkNotificationRead(pageId?: string) {
  const queryClient = useQueryClient(); const table = pageId ? "page_notifications" : "notifications";
  return useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from(table).update({ read_at: new Date().toISOString() }).eq("id", id); if (error) throw error; }, onSuccess: () => void queryClient.invalidateQueries({ queryKey: [pageId ? "mobile-page-notifications" : "mobile-notifications"] }) });
}

export function useMarkAllNotificationsRead(pageId?: string) {
  const { user } = useAuth(); const queryClient = useQueryClient(); const table = pageId ? "page_notifications" : "notifications";
  return useMutation({ mutationFn: async () => { if (!pageId && !user) return; let query = supabase.from(table).update({ read_at: new Date().toISOString() }).is("read_at", null); query = pageId ? query.eq("page_id", pageId) : query.eq("user_id", user!.id); const { error } = await query; if (error) throw error; }, onSuccess: () => void queryClient.invalidateQueries({ queryKey: [pageId ? "mobile-page-notifications" : "mobile-notifications"] }) });
}

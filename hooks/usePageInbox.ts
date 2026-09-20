// File: hooks/usePageInbox.ts
//
// Only the conversation list + unread count so far (Bottom Nav badge
// while acting as a page). Thread / send / mark-read port with the
// Page Inbox screens.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export interface PageConversationSummary {
  id: string;
  last_message_at: string;
  other_participant: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  last_message: { content: string; sender_type: "page" | "profile" } | null;
  unreadCount: number;
}

export interface PageMessage {
  id: string;
  conversation_id: string;
  sender_type: "page" | "profile";
  content: string;
  created_at: string;
  read_at: string | null;
}

export function usePageConversations(pageId: string | undefined) {
  return useQuery({
    queryKey: ["page-conversations", pageId],
    queryFn: async (): Promise<PageConversationSummary[]> => {
      if (!pageId) return [];

      const { data, error } = await supabase
        .from("page_conversations")
        .select(
          `id, last_message_at,
           other_participant:profiles!page_conversations_other_profile_id_fkey(id, username, display_name, avatar_url),
           page_messages(content, sender_type, created_at, read_at)`
        )
        .eq("page_id", pageId)
        .order("last_message_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row: any) => {
        const messages = (row.page_messages ?? []) as PageMessage[];
        const last = messages.length
          ? messages.reduce((a, b) => (a.created_at > b.created_at ? a : b))
          : null;
        const unreadCount = messages.filter((m) => m.sender_type === "profile" && !m.read_at).length;
        return {
          id: row.id,
          last_message_at: row.last_message_at,
          other_participant: row.other_participant,
          last_message: last ? { content: last.content, sender_type: last.sender_type } : null,
          unreadCount,
        };
      });
    },
    enabled: !!pageId,
    refetchInterval: 15_000,
  });
}

export function usePageInboxUnreadCount(pageId: string | undefined): number {
  const { data } = usePageConversations(pageId);
  return data?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0;
}

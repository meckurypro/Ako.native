// File: hooks/useMessaging.ts
//
// LEAN STAND-IN — only useUnreadConversationCount, for the Messages tab
// badge. Web derives this from useConversations() (which also fetches
// participants + last messages per conversation). That hook isn't ported
// yet, so this runs just the queries the count actually depends on, with
// the same rules: hidden/archived conversations excluded, left
// conversations never count, and the badge is the number of
// CONVERSATIONS with anything unread (not total messages).
//
// When the real useMessaging.ts is ported, replace this file wholesale —
// the export name is identical. The query key below sits under
// ["conversations", userId] so AuthProvider's realtime invalidation of
// that key already refreshes it.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export function useUnreadConversationCount(): number {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["conversations", user?.id, "unread-count"],
    queryFn: async (): Promise<number> => {
      const userId = user!.id;

      const { data: participation, error } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at, archived_at, hidden_at, left_at")
        .eq("user_id", userId);
      if (error) throw error;

      const visible = (participation ?? []).filter((p) => !p.hidden_at && !p.archived_at);
      if (!visible.length) return 0;

      const conversationIds = visible.map((p) => p.conversation_id as string);
      const readMap = new Map<string, string | null>(
        visible.map((p) => [p.conversation_id as string, p.last_read_at as string | null])
      );
      const leftSet = new Set(visible.filter((p) => !!p.left_at).map((p) => p.conversation_id as string));

      // One query for every incoming message, counted client-side against
      // each conversation's own last_read_at cutoff (same cap as web).
      const { data: incoming, error: msgError } = await supabase
        .from("messages")
        .select("conversation_id, sender_id, created_at")
        .in("conversation_id", conversationIds)
        .neq("sender_id", userId)
        .order("created_at", { ascending: false })
        .limit(Math.min(Math.max(conversationIds.length * 20, 100), 5000));
      if (msgError || !incoming) return 0;

      const unreadConversations = new Set<string>();
      for (const row of incoming) {
        const id = row.conversation_id as string;
        if (leftSet.has(id)) continue;
        const lastReadAt = readMap.get(id);
        if (lastReadAt && (row.created_at as string) <= lastReadAt) continue;
        unreadConversations.add(id);
      }
      return unreadConversations.size;
    },
    enabled: !!user,
    refetchInterval: 15_000,
  });

  return data ?? 0;
}

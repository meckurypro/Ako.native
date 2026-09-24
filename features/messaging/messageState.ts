// File: features/messaging/messageState.ts
// Per-message actions layered on top of features/messaging/api.ts: per-user state
// (star / pin / hide / delete-for-me / view-once), emoji reactions, delete scopes and
// in-app forwarding. Mirrors web's hooks/useMessageReactions.ts + the delete/forward
// hooks in hooks/useMessaging.ts, against the same tables and RPCs.
import { useEffect } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { isCurrentlyOffline } from "@/lib/network";
import { decodeVoiceNote, encodeVoiceNote, type Message } from "@/features/messaging/api";
import { DEFAULT_TOP_EMOJIS } from "@/features/messaging/emoji";

export type MessageUserState = {
  message_id: string;
  starred_at: string | null;
  pinned_at: string | null;
  hidden_at: string | null;
  deleted_for_me_at: string | null;
  opened_once_at: string | null;
};
type UserStatePatch = Partial<Omit<MessageUserState, "message_id">>;
export type MessageReaction = { message_id: string; user_id: string; emoji: string };
export type DeleteScope = "me" | "everyone";

const stateKey = (conversationId: string) => ["mobile-message-state", conversationId] as const;
const reactionKey = (conversationId: string) => ["mobile-message-reactions", conversationId] as const;

export class OfflineActionError extends Error {
  constructor() { super("You're offline. Try again once you're back online."); }
}
async function requireOnline() { if (await isCurrentlyOffline()) throw new OfflineActionError(); }

// Select-then-update-or-insert on purpose (same as web): an upsert would depend on the
// exact name of the unique constraint, and this only relies on plain select/insert/update.
export async function upsertMessageUserState(userId: string, messageId: string, patch: UserStatePatch) {
  const { data: existing, error: selectError } = await supabase.from("message_user_state").select("message_id").eq("message_id", messageId).eq("user_id", userId).maybeSingle();
  if (selectError) throw selectError;
  if (existing) {
    const { error } = await supabase.from("message_user_state").update(patch).eq("message_id", messageId).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("message_user_state").insert({ message_id: messageId, user_id: userId, ...patch });
    if (error) throw error;
  }
}

export function useMessageUserStates(conversationId: string, messageIds: string[]) {
  const { user } = useAuth();
  // The count is part of the key so a newly arrived message refetches state, and
  // keepPreviousData stops star/pin badges flickering while that happens.
  return useQuery({
    queryKey: [...stateKey(conversationId), user?.id, messageIds.length],
    enabled: !!user && messageIds.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Record<string, MessageUserState>> => {
      const { data, error } = await supabase.from("message_user_state").select("message_id, starred_at, pinned_at, hidden_at, deleted_for_me_at, opened_once_at").in("message_id", messageIds).eq("user_id", user!.id);
      if (error) throw error;
      const map: Record<string, MessageUserState> = {};
      for (const row of (data ?? []) as MessageUserState[]) map[row.message_id] = row;
      return map;
    },
  });
}

function patchStateCache(client: ReturnType<typeof useQueryClient>, conversationId: string, ids: string[], patch: UserStatePatch) {
  client.setQueriesData<Record<string, MessageUserState>>({ queryKey: stateKey(conversationId) }, old => {
    const next = { ...(old ?? {}) };
    for (const id of ids) {
      const base: MessageUserState = next[id] ?? { message_id: id, starred_at: null, pinned_at: null, hidden_at: null, deleted_for_me_at: null, opened_once_at: null };
      next[id] = { ...base, ...patch };
    }
    return next;
  });
}

/** Star / pin / hide for one message, with an optimistic cache write so the badge flips instantly. */
export function useToggleMessageState(conversationId: string, field: "starred_at" | "pinned_at" | "hidden_at") {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, active }: { messageId: string; active: boolean }) => {
      if (!user) throw new Error("Not signed in");
      await requireOnline();
      await upsertMessageUserState(user.id, messageId, { [field]: active ? new Date().toISOString() : null });
    },
    onMutate: ({ messageId, active }) => patchStateCache(client, conversationId, [messageId], { [field]: active ? new Date().toISOString() : null }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: stateKey(conversationId) });
      if (field === "hidden_at") void client.invalidateQueries({ queryKey: ["mobile-hidden-messages", conversationId] });
    },
  });
}

export function useBulkMessageState(conversationId: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageIds, patch }: { messageIds: string[]; patch: UserStatePatch }) => {
      if (!user) throw new Error("Not signed in");
      await requireOnline();
      for (const id of messageIds) await upsertMessageUserState(user.id, id, patch);
    },
    onMutate: ({ messageIds, patch }) => patchStateCache(client, conversationId, messageIds, patch),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: stateKey(conversationId) });
      void client.invalidateQueries({ queryKey: ["mobile-hidden-messages", conversationId] });
    },
  });
}

/** Marks a view-once voice note as opened for this user (persisted, so it's the same on every device). */
export function useMarkVoiceNoteOpened(conversationId: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => { if (!user) throw new Error("Not signed in"); await upsertMessageUserState(user.id, messageId, { opened_once_at: new Date().toISOString() }); },
    onMutate: (messageId) => patchStateCache(client, conversationId, [messageId], { opened_once_at: new Date().toISOString() }),
    onSettled: () => void client.invalidateQueries({ queryKey: stateKey(conversationId) }),
  });
}

/** Deletes one or many messages. "everyone" tombstones the row; "me" is a permanent per-user flag. */
export function useDeleteMessages(conversationId: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageIds, scope }: { messageIds: string[]; scope: DeleteScope }) => {
      if (!messageIds.length) return;
      await requireOnline();
      if (scope === "everyone") {
        const { error } = await supabase.from("messages").update({ is_deleted: true }).in("id", messageIds);
        if (error) throw error;
        return;
      }
      if (!user) throw new Error("Not signed in");
      const now = new Date().toISOString();
      for (const id of messageIds) await upsertMessageUserState(user.id, id, { deleted_for_me_at: now });
    },
    onMutate: ({ messageIds, scope }) => {
      if (scope === "everyone") client.setQueryData<Message[]>(["mobile-messages", conversationId], old => old?.map(m => messageIds.includes(m.id) ? { ...m, is_deleted: true } : m));
      else patchStateCache(client, conversationId, messageIds, { deleted_for_me_at: new Date().toISOString() });
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["mobile-messages", conversationId] });
      void client.invalidateQueries({ queryKey: ["mobile-conversations"] });
      void client.invalidateQueries({ queryKey: stateKey(conversationId) });
    },
  });
}

// ---- Reactions ----
export function useConversationReactions(conversationId: string, messageIds: string[]) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...reactionKey(conversationId), messageIds.length],
    enabled: messageIds.length > 0,
    placeholderData: keepPreviousData,
    refetchInterval: 8000,
    queryFn: async (): Promise<Record<string, MessageReaction[]>> => {
      const { data, error } = await supabase.from("message_reactions").select("message_id, user_id, emoji").in("message_id", messageIds);
      if (error) throw error;
      const grouped: Record<string, MessageReaction[]> = {};
      for (const row of (data ?? []) as MessageReaction[]) (grouped[row.message_id] ??= []).push(row);
      return grouped;
    },
  });
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase.channel(`mobile-message-reactions:${conversationId}`).on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => void client.invalidateQueries({ queryKey: reactionKey(conversationId) })).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, client]);
  return query;
}

function patchReactionCache(client: ReturnType<typeof useQueryClient>, conversationId: string, userId: string, messageId: string, emoji: string | null) {
  client.setQueriesData<Record<string, MessageReaction[]>>({ queryKey: reactionKey(conversationId) }, old => {
    const next = { ...(old ?? {}) };
    const others = (next[messageId] ?? []).filter(r => r.user_id !== userId);
    next[messageId] = emoji ? [...others, { message_id: messageId, user_id: userId, emoji }] : others;
    return next;
  });
}

export function useSetReaction(conversationId: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      await requireOnline();
      const { error } = await supabase.rpc("set_message_reaction", { p_message_id: messageId, p_emoji: emoji });
      if (error) throw error;
    },
    onMutate: ({ messageId, emoji }) => { if (user) patchReactionCache(client, conversationId, user.id, messageId, emoji); },
    onSettled: () => { void client.invalidateQueries({ queryKey: reactionKey(conversationId) }); void client.invalidateQueries({ queryKey: ["mobile-user-top-emojis"] }); },
  });
}

export function useRemoveReaction(conversationId: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      await requireOnline();
      const { error } = await supabase.rpc("remove_message_reaction", { p_message_id: messageId });
      if (error) throw error;
    },
    onMutate: (messageId) => { if (user) patchReactionCache(client, conversationId, user.id, messageId, null); },
    onSettled: () => void client.invalidateQueries({ queryKey: reactionKey(conversationId) }),
  });
}

/** The 12 emojis on the quick-react strip: the user's most used, padded with defaults. */
export function useUserTopEmojis(): string[] {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["mobile-user-top-emojis", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("user_emoji_usage").select("emoji").eq("user_id", user!.id).order("use_count", { ascending: false }).order("last_used_at", { ascending: false }).limit(12);
      if (error) throw error;
      return (data ?? []).map(row => row.emoji as string);
    },
  });
  const padded = [...(data ?? [])];
  for (const emoji of DEFAULT_TOP_EMOJIS) { if (padded.length >= 12) break; if (!padded.includes(emoji)) padded.push(emoji); }
  return padded.slice(0, 12);
}

// ---- Forward ----
// Text is forwarded as a fresh message (no reply link). Voice notes live under the
// sender's folder for the *source* conversation and storage RLS only lets participants of
// that conversation read them, so each target gets its own server-side copy of the file.
export function useForwardMessages() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ messages, targetConversationIds }: { messages: Pick<Message, "content">[]; targetConversationIds: string[] }) => {
      if (!user) throw new Error("Not signed in");
      if (!messages.length || !targetConversationIds.length) return;
      await requireOnline();
      const rows: { conversation_id: string; sender_id: string; content: string; delivered_at: string }[] = [];
      for (const conversation_id of targetConversationIds) {
        for (const message of messages) {
          let content = message.content;
          const voice = decodeVoiceNote(content);
          if (voice?.path) {
            const extension = voice.path.split(".").pop() || "m4a";
            const copyPath = `${user.id}/dm/${conversation_id}/${Date.now()}-${rows.length}.${extension}`;
            const { error } = await supabase.storage.from("audio").copy(voice.path, copyPath);
            if (error) throw error;
            content = encodeVoiceNote({ ...voice, path: copyPath, viewOnce: false });
          }
          rows.push({ conversation_id, sender_id: user.id, content, delivered_at: new Date().toISOString() });
        }
      }
      const { error } = await supabase.from("messages").insert(rows);
      if (error) throw error;
      await supabase.from("conversation_participants").update({ is_request: false, archived_at: null }).eq("user_id", user.id).in("conversation_id", targetConversationIds).eq("is_request", true);
    },
    onSuccess: (_data, variables) => {
      for (const id of variables.targetConversationIds) void client.invalidateQueries({ queryKey: ["mobile-messages", id] });
      void client.invalidateQueries({ queryKey: ["mobile-conversations"] });
    },
  });
}

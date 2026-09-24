// File: lib/outbox.ts
// Messages sent while offline are written here instead of failing outright.
// Each row is retried in order once we're back online; the message stays
// visible in the thread the whole time via a local id, and is reconciled
// with its real server row once the send succeeds.
import { safeDb } from "./sqlite";
import { supabase } from "./supabase";
import { queryClient } from "./query-client";
import { cacheMessages } from "./local-cache";
import type { Message } from "@/features/messaging/api";

export type OutboxKind = "text";
type OutboxPayload = { content: string; senderId: string; replyToMessageId?: string | null };
type OutboxRow = { local_id: string; kind: OutboxKind; conversation_id: string; payload: string; created_at: string; attempts: number };

let flushing = false;

export async function enqueueOutboxMessage(localId: string, conversationId: string, payload: OutboxPayload) {
  await safeDb((db) =>
    db.runAsync(
      "INSERT INTO outbox (local_id, kind, conversation_id, payload, created_at, attempts) VALUES (?, 'text', ?, ?, ?, 0);",
      [localId, conversationId, JSON.stringify(payload), new Date().toISOString()]
    )
  );
}

export function isLocalMessageId(id: string) {
  return id.startsWith("ako-local:");
}

export function makeLocalMessageId() {
  return `ako-local:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

/** Attempts to send every queued message, oldest first, stopping at the first failure so retries stay in order. Safe to call repeatedly; re-entrant calls no-op. */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const rows = (await safeDb((db) => db.getAllAsync<OutboxRow>("SELECT * FROM outbox ORDER BY created_at ASC;"))) ?? [];
    for (const row of rows) {
      const payload = JSON.parse(row.payload) as OutboxPayload;
      try {
        const { data, error } = await supabase
          .from("messages")
          .insert({ conversation_id: row.conversation_id, sender_id: payload.senderId, content: payload.content, delivered_at: new Date().toISOString(), reply_to_message_id: payload.replyToMessageId ?? null })
          .select("id, conversation_id, sender_id, content, created_at, delivered_at, read_at, reply_to_message_id, is_deleted")
          .single();
        if (error) throw error;

        await safeDb((db) => db.runAsync("DELETE FROM outbox WHERE local_id = ?;", [row.local_id]));
        reconcileLocalMessage(row.conversation_id, row.local_id, data as Message);
      } catch (error) {
        await safeDb((db) => db.runAsync("UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE local_id = ?;", [String(error), row.local_id]));
        break; // leave the rest queued for the next reconnect/flush, in order
      }
    }
  } finally {
    flushing = false;
  }
}

export async function getPendingOutboxCount(conversationId: string): Promise<number> {
  const row = await safeDb((db) => db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM outbox WHERE conversation_id = ?;", [conversationId]));
  return row?.count ?? 0;
}

function reconcileLocalMessage(conversationId: string, localId: string, serverMessage: Message) {
  queryClient.setQueryData<Message[]>(["mobile-messages", conversationId], (old) =>
    (old ?? []).map((message) => (message.id === localId ? serverMessage : message))
  );
  void cacheMessages(conversationId, [serverMessage]);
  void queryClient.invalidateQueries({ queryKey: ["mobile-conversations"] });
  // Same call features/messaging/api.ts's notifyPush makes — inlined rather than
  // imported, since that module imports this one (import cycle).
  void supabase.functions.invoke("send-message-push", { body: { message_id: serverMessage.id } }).catch((error) => console.warn("send-message-push failed", error));
}

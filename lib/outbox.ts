// File: lib/outbox.ts
// Writes made while offline are queued here instead of failing outright.
// Each row is retried in order once we're back online; the item (message or
// post) stays visible where it belongs the whole time via a local id, and is
// reconciled with its real server row once the send succeeds.
//
// Started out message-only; `post` support (queuing new posts made offline —
// see enqueueOutboxPost/features/posts) reuses the same table and flush loop,
// just with its own payload shape and insert target.
import { Directory, File, Paths } from "expo-file-system";
import { safeDb } from "./sqlite";
import { supabase } from "./supabase";
import { queryClient } from "./query-client";
import { cacheMessages } from "./local-cache";
import type { Message } from "@/features/messaging/api";

export type OutboxKind = "text" | "post" | "voice";
type OutboxMessagePayload = { content: string; senderId: string; replyToMessageId?: string | null };
// Mirrors the body useCreatePost (features/compose/api.ts) sends to the
// create-post/create-page-post Edge Functions — replaying a queued post goes
// through the same functions, not a raw table insert, so it gets the same
// validation, moderation, and post_topics/interest linking a normal post does.
export type OutboxPostPayload = { heading?: string; heading_color?: string | null; content: string; interest_ids: string[]; media_urls: string[]; status?: "draft" | "scheduled"; scheduled_for?: string; posted_as_page_id?: string };
// A voice note recorded offline. `localUri` is a copy of the recording under the app's document
// directory (the recorder's own file lives in the cache dir, which the OS may purge before we
// reconnect); it is uploaded to storage and deleted once the message row is created.
export type OutboxVoicePayload = { senderId: string; localUri: string; contentType: string; durationSec: number; peaks?: number[]; viewOnce?: boolean };
type OutboxRow = { local_id: string; kind: OutboxKind; conversation_id: string | null; payload: string; created_at: string; attempts: number };

let flushing = false;

export async function enqueueOutboxMessage(localId: string, conversationId: string, payload: OutboxMessagePayload) {
  await safeDb((db) =>
    db.runAsync(
      "INSERT INTO outbox (local_id, kind, conversation_id, payload, created_at, attempts) VALUES (?, 'text', ?, ?, ?, 0);",
      [localId, conversationId, JSON.stringify(payload), new Date().toISOString()]
    )
  );
}

export async function enqueueOutboxPost(localId: string, payload: OutboxPostPayload) {
  await safeDb((db) =>
    db.runAsync(
      "INSERT INTO outbox (local_id, kind, conversation_id, payload, created_at, attempts) VALUES (?, 'post', NULL, ?, ?, 0);",
      [localId, JSON.stringify(payload), new Date().toISOString()]
    )
  );
}

/** Copies a fresh recording somewhere the OS won't clear, so it survives until we're back online. */
export function persistOutboxAudio(uri: string): string {
  const dir = new Directory(Paths.document, "outbox-audio");
  if (!dir.exists) dir.create({ intermediates: true });
  const extension = uri.split("?")[0].split(".").pop() || "m4a";
  const destination = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`);
  new File(uri).copy(destination);
  return destination.uri;
}

export async function enqueueOutboxVoice(localId: string, conversationId: string, payload: OutboxVoicePayload) {
  await safeDb((db) =>
    db.runAsync(
      "INSERT INTO outbox (local_id, kind, conversation_id, payload, created_at, attempts) VALUES (?, 'voice', ?, ?, ?, 0);",
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

export function isLocalPostId(id: string) {
  return id.startsWith("ako-local-post:");
}

export function makeLocalPostId() {
  return `ako-local-post:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

/** Attempts to send every queued item, oldest first, stopping at the first failure so retries stay in order. Safe to call repeatedly; re-entrant calls no-op. */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const rows = (await safeDb((db) => db.getAllAsync<OutboxRow>("SELECT * FROM outbox ORDER BY created_at ASC;"))) ?? [];
    for (const row of rows) {
      try {
        if (row.kind === "post") await flushOutboxPost(row);
        else if (row.kind === "voice") await flushOutboxVoice(row);
        else await flushOutboxMessage(row);
        await safeDb((db) => db.runAsync("DELETE FROM outbox WHERE local_id = ?;", [row.local_id]));
      } catch (error) {
        await safeDb((db) => db.runAsync("UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE local_id = ?;", [String(error), row.local_id]));
        break; // leave the rest queued for the next reconnect/flush, in order
      }
    }
  } finally {
    flushing = false;
  }
}

async function flushOutboxMessage(row: OutboxRow) {
  const payload = JSON.parse(row.payload) as OutboxMessagePayload;
  const conversationId = row.conversation_id!;
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: payload.senderId, content: payload.content, delivered_at: new Date().toISOString(), reply_to_message_id: payload.replyToMessageId ?? null })
    .select("id, conversation_id, sender_id, content, created_at, delivered_at, read_at, reply_to_message_id, is_deleted")
    .single();
  if (error) throw error;
  reconcileLocalMessage(conversationId, row.local_id, data as Message);
}

async function flushOutboxVoice(row: OutboxRow) {
  const payload = JSON.parse(row.payload) as OutboxVoicePayload;
  const conversationId = row.conversation_id!;
  const file = new File(payload.localUri);
  if (!file.exists) return; // recording is gone (cleared storage); drop the row rather than retry forever
  const extension = payload.localUri.split(".").pop() || "m4a";
  const path = `${payload.senderId}/dm/${conversationId}/${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("audio").upload(path, file, { contentType: payload.contentType });
  if (uploadError) throw uploadError;
  // Imported lazily: features/messaging/api imports this module, so a top-level import would be a cycle.
  const { encodeVoiceNote } = await import("@/features/messaging/api");
  const content = encodeVoiceNote({ path, durationSec: payload.durationSec, peaks: payload.peaks, viewOnce: payload.viewOnce });
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: payload.senderId, content, delivered_at: new Date().toISOString() })
    .select("id, conversation_id, sender_id, content, created_at, delivered_at, read_at, reply_to_message_id, is_deleted")
    .single();
  if (error) throw error; // the uploaded object is orphaned if this fails; the retry uploads a fresh copy
  await supabase.from("conversation_participants").update({ is_request: false, archived_at: null }).eq("conversation_id", conversationId).eq("user_id", payload.senderId);
  reconcileLocalMessage(conversationId, row.local_id, data as Message);
  try { file.delete(); } catch { /* best-effort cleanup */ }
}

async function flushOutboxPost(row: OutboxRow) {
  const { posted_as_page_id, ...body } = JSON.parse(row.payload) as OutboxPostPayload;
  const { data, error } = posted_as_page_id
    ? await supabase.functions.invoke("create-page-post", { body: { ...body, page_id: posted_as_page_id } })
    : await supabase.functions.invoke("create-post", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  reconcileLocalPost(row.local_id);
}

export async function getPendingOutboxCount(conversationId: string): Promise<number> {
  const row = await safeDb((db) => db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM outbox WHERE conversation_id = ?;", [conversationId]));
  return row?.count ?? 0;
}

export async function getTotalPendingOutboxCount(): Promise<number> {
  const row = await safeDb((db) => db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM outbox;"));
  return row?.count ?? 0;
}

export async function getPendingOutboxPostCount(): Promise<number> {
  const row = await safeDb((db) => db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM outbox WHERE kind = 'post';"));
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

function reconcileLocalPost(localId: string) {
  // Feed pages are keyed by post id and read from the server on the next
  // fetch anyway (unlike messages there's no single small query key to patch
  // in place across every feed variant) — simplest correct fix is dropping
  // the local placeholder and letting the normal feed/identity-posts queries
  // refetch, matching useCreatePost's own onSuccess invalidation.
  void queryClient.invalidateQueries({ queryKey: ["feed"] });
  void queryClient.invalidateQueries({ queryKey: ["identity-posts"] });
  if (__DEV__) console.log(`[outbox] flushed queued post ${localId}`);
}

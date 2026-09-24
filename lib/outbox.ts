// File: lib/outbox.ts
// Writes made while offline are queued here instead of failing outright.
// Each row is retried in order once we're back online; the item (message or
// post) stays visible where it belongs the whole time via a local id, and is
// reconciled with its real server row once the send succeeds.
//
// Started out message-only; `post` support (queuing new posts made offline —
// see enqueueOutboxPost/features/posts) reuses the same table and flush loop,
// just with its own payload shape and insert target.
//
// Delivery rules (so one bad row can never stall the rest):
//  - Rows are scoped to the user who queued them (`user_id`) and only ever flush while that user
//    is signed in; a sign-out keeps them, an account switch never sends them as someone else.
//  - Errors are classified. Transient ones (no network, timeout, 5xx, 429) keep the row and back
//    off; permanent ones (4xx, RLS, moderation, a vanished recording) dead-letter it immediately
//    (status='failed') for the user to retry or discard. Either way a row gets MAX_ATTEMPTS tries.
//  - A failing row only holds back later rows of the *same conversation*, so message order is kept
//    but other chats and posts keep flowing.
//  - Message inserts carry a client-generated id, so retrying after a timed-out-but-successful
//    insert is a no-op rather than a duplicate.
import { Directory, File, Paths } from "expo-file-system";
import { safeDb } from "./sqlite";
import { supabase } from "./supabase";
import { queryClient } from "./query-client";
import { cacheMessages } from "./local-cache";
import { isCurrentlyOffline } from "./network";
import { makeUuid } from "./uuid";
import type { Message } from "@/features/messaging/api";

export type OutboxKind = "text" | "post" | "voice";
type OutboxMessagePayload = { content: string; senderId: string; replyToMessageId?: string | null; serverId?: string };
// Mirrors the body useCreatePost (features/compose/api.ts) sends to the
// create-post/create-page-post Edge Functions — replaying a queued post goes
// through the same functions, not a raw table insert, so it gets the same
// validation, moderation, and post_topics/interest linking a normal post does.
export type OutboxPostPayload = { heading?: string; heading_color?: string | null; content: string; interest_ids: string[]; media_urls: string[]; status?: "draft" | "scheduled"; scheduled_for?: string; posted_as_page_id?: string };
// A voice note recorded offline. `localUri` is a copy of the recording under the app's document
// directory (the recorder's own file lives in the cache dir, which the OS may purge before we
// reconnect); it is uploaded to storage and deleted once the message row is created.
export type OutboxVoicePayload = { senderId: string; localUri: string; contentType: string; durationSec: number; peaks?: number[]; viewOnce?: boolean; replyToMessageId?: string | null; serverId?: string };
export type OutboxStatus = "pending" | "failed";
type OutboxRow = {
  local_id: string; kind: OutboxKind; conversation_id: string | null; payload: string; created_at: string;
  attempts: number; last_error: string | null; user_id: string | null; status: OutboxStatus; next_attempt_at: number;
};

/** Tries per row before it is dead-lettered, counting transient failures only (a dead network never burns one). */
export const OUTBOX_MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_CAP_MS = 5 * 60_000;

let flushing = false;
let flushRequested = false;

// SQLite has no live queries, so anything that shows outbox state (pending-post cards, banners,
// counts) subscribes here and re-reads when a row is enqueued, sent, failed, retried or discarded.
const listeners = new Set<() => void>();
export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function emitOutboxChange() {
  listeners.forEach((listener) => { try { listener(); } catch { /* a bad subscriber must not break delivery */ } });
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** A failure retrying can't fix (validation, moderation, missing local file). Dead-letters the row at once. */
export class OutboxPermanentError extends Error {
  constructor(message: string) { super(message); this.name = "OutboxPermanentError"; }
}

// PostgREST codes that mean "the service or our token is momentarily unusable", not "this write is bad".
const TRANSIENT_PGRST = new Set(["PGRST000", "PGRST001", "PGRST002", "PGRST300", "PGRST301", "PGRST302", "PGRST303"]);

function errorStatus(error: unknown): number | undefined {
  const e = error as { context?: { status?: unknown }; status?: unknown; statusCode?: unknown } | null;
  const raw = e?.context?.status ?? e?.status ?? e?.statusCode;
  const value = typeof raw === "string" ? parseInt(raw, 10) : raw;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * True when retrying the same write can't succeed. Network failures (which surface with no code and
 * no HTTP status), timeouts, 5xx, 408 and 429 are transient; other 4xx, RLS failures (42501), constraint
 * violations and RAISE EXCEPTION rejections from moderation triggers (P0001) are permanent.
 */
export function isPermanentOutboxError(error: unknown): boolean {
  if (error instanceof OutboxPermanentError) return true;
  const e = error as { name?: string; code?: unknown } | null;
  if (!e) return false;
  if (e.name === "FunctionsFetchError" || e.name === "FunctionsRelayError") return false;
  const code = typeof e.code === "string" ? e.code : "";
  if (code) {
    if (code.startsWith("PGRST")) return !TRANSIENT_PGRST.has(code);
    return !/^(08|53|57|40)/.test(code); // connection, resources, operator intervention, serialization/deadlock
  }
  const status = errorStatus(error);
  if (status !== undefined) return status >= 400 && status < 500 && status !== 408 && status !== 429;
  return false;
}

function describeError(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  return String(typeof message === "string" && message ? message : error).slice(0, 300);
}

export async function enqueueOutboxMessage(localId: string, conversationId: string, payload: OutboxMessagePayload) {
  const withId = { ...payload, serverId: payload.serverId ?? makeUuid() };
  await safeDb((db) =>
    db.runAsync(
      "INSERT INTO outbox (local_id, kind, conversation_id, payload, created_at, attempts, user_id, status, next_attempt_at) VALUES (?, 'text', ?, ?, ?, 0, ?, 'pending', 0);",
      [localId, conversationId, JSON.stringify(withId), new Date().toISOString(), payload.senderId]
    )
  );
  emitOutboxChange();
}

export async function enqueueOutboxPost(localId: string, payload: OutboxPostPayload, userId?: string) {
  const owner = userId ?? (await currentUserId());
  if (!owner) throw new Error("You need to be signed in to queue a post.");
  await safeDb((db) =>
    db.runAsync(
      "INSERT INTO outbox (local_id, kind, conversation_id, payload, created_at, attempts, user_id, status, next_attempt_at) VALUES (?, 'post', NULL, ?, ?, 0, ?, 'pending', 0);",
      [localId, JSON.stringify(payload), new Date().toISOString(), owner]
    )
  );
  emitOutboxChange();
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
  const withId = { ...payload, serverId: payload.serverId ?? makeUuid() };
  await safeDb((db) =>
    db.runAsync(
      "INSERT INTO outbox (local_id, kind, conversation_id, payload, created_at, attempts, user_id, status, next_attempt_at) VALUES (?, 'voice', ?, ?, ?, 0, ?, 'pending', 0);",
      [localId, conversationId, JSON.stringify(withId), new Date().toISOString(), payload.senderId]
    )
  );
  emitOutboxChange();
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

/**
 * Sends the current user's queued items, oldest first. Safe to call from anywhere, as often as you
 * like: a call made while a pass is running isn't dropped, it schedules one more pass right after.
 */
export async function flushOutbox(): Promise<void> {
  if (flushing) { flushRequested = true; return; }
  flushing = true;
  try {
    do {
      flushRequested = false;
      await flushPass();
    } while (flushRequested);
  } finally {
    flushing = false;
  }
}

async function flushPass(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const rows = (await safeDb((db) =>
    db.getAllAsync<OutboxRow>("SELECT * FROM outbox WHERE user_id = ? AND status = 'pending' ORDER BY created_at ASC;", [userId])
  )) ?? [];
  // Conversations with an earlier row that is waiting to retry: later rows in the same chat wait
  // too so messages can't arrive out of order. Everything else keeps flowing.
  const blocked = new Set<string>();
  for (const row of rows) {
    if (row.conversation_id && blocked.has(row.conversation_id)) continue;
    if (row.next_attempt_at > Date.now()) { if (row.conversation_id) blocked.add(row.conversation_id); continue; }
    // The account may have been switched while an earlier row was in flight; never send as someone else.
    if ((await currentUserId()) !== userId) return;
    try {
      if (row.kind === "post") await flushOutboxPost(row);
      else if (row.kind === "voice") await flushOutboxVoice(row);
      else await flushOutboxMessage(row);
      await safeDb((db) => db.runAsync("DELETE FROM outbox WHERE local_id = ?;", [row.local_id]));
      emitOutboxChange();
    } catch (error) {
      if (isPermanentOutboxError(error)) {
        await markFailed(row, error);
      } else if (await isCurrentlyOffline()) {
        return; // network is down: leave every remaining row untouched (no attempt burned); reconnect/foreground/timer will retry
      } else {
        await recordTransientFailure(row, error);
        if (row.conversation_id) blocked.add(row.conversation_id);
      }
    }
  }
}

async function markFailed(row: OutboxRow, error: unknown) {
  await safeDb((db) => db.runAsync("UPDATE outbox SET status = 'failed', attempts = attempts + 1, last_error = ? WHERE local_id = ?;", [describeError(error), row.local_id]));
  emitOutboxChange();
}

async function recordTransientFailure(row: OutboxRow, error: unknown) {
  const attempts = row.attempts + 1;
  if (attempts >= OUTBOX_MAX_ATTEMPTS) {
    await markFailed(row, error);
    return;
  }
  const delay = Math.min(BACKOFF_BASE_MS * 2 ** (attempts - 1), BACKOFF_CAP_MS);
  await safeDb((db) => db.runAsync("UPDATE outbox SET attempts = ?, last_error = ?, next_attempt_at = ? WHERE local_id = ?;", [attempts, describeError(error), Date.now() + delay, row.local_id]));
  emitOutboxChange();
}

/** Gives the row a stable server id the first time it is attempted, so a retry can't create a second copy. */
async function ensureServerId<T extends { serverId?: string }>(row: OutboxRow, payload: T): Promise<string> {
  if (payload.serverId) return payload.serverId;
  const serverId = makeUuid();
  payload.serverId = serverId;
  await safeDb((db) => db.runAsync("UPDATE outbox SET payload = ? WHERE local_id = ?;", [JSON.stringify(payload), row.local_id]));
  return serverId;
}

const MESSAGE_COLUMNS = "id, conversation_id, sender_id, content, created_at, delivered_at, read_at, reply_to_message_id, is_deleted";

/** Inserts with a client-chosen id. A duplicate-key error means an earlier attempt already landed, so fetch that row instead. */
async function insertMessageOnce(values: { id: string; conversation_id: string; sender_id: string; content: string; reply_to_message_id?: string | null }): Promise<{ message: Message; alreadySent: boolean }> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ ...values, delivered_at: new Date().toISOString() })
    .select(MESSAGE_COLUMNS)
    .single();
  if (!error) return { message: data as Message, alreadySent: false };
  if (error.code === "23505") {
    const existing = await supabase.from("messages").select(MESSAGE_COLUMNS).eq("id", values.id).maybeSingle();
    if (existing.data) return { message: existing.data as Message, alreadySent: true };
  }
  throw error;
}

async function flushOutboxMessage(row: OutboxRow) {
  const payload = JSON.parse(row.payload) as OutboxMessagePayload;
  const conversationId = row.conversation_id!;
  const id = await ensureServerId(row, payload);
  const { message, alreadySent } = await insertMessageOnce({ id, conversation_id: conversationId, sender_id: payload.senderId, content: payload.content, reply_to_message_id: payload.replyToMessageId ?? null });
  reconcileLocalMessage(conversationId, row.local_id, message, !alreadySent);
}

async function flushOutboxVoice(row: OutboxRow) {
  const payload = JSON.parse(row.payload) as OutboxVoicePayload;
  const conversationId = row.conversation_id!;
  const file = new File(payload.localUri);
  // The recording is gone (storage cleared, app data restored elsewhere). Retrying can't bring it back.
  if (!file.exists) throw new OutboxPermanentError("The recording is no longer on this device.");
  const id = await ensureServerId(row, payload);
  const extension = payload.localUri.split(".").pop() || "m4a";
  // Deterministic path: a retry after a lost response uploads to the same object and finds it already there.
  const path = `${payload.senderId}/dm/${conversationId}/${id}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("audio").upload(path, file, { contentType: payload.contentType });
  if (uploadError && !isDuplicateUpload(uploadError)) throw uploadError;
  // Imported lazily: features/messaging/api imports this module, so a top-level import would be a cycle.
  const { encodeVoiceNote } = await import("@/features/messaging/api");
  const content = encodeVoiceNote({ path, durationSec: payload.durationSec, peaks: payload.peaks, viewOnce: payload.viewOnce });
  const { message, alreadySent } = await insertMessageOnce({ id, conversation_id: conversationId, sender_id: payload.senderId, content, reply_to_message_id: payload.replyToMessageId ?? null });
  await supabase.from("conversation_participants").update({ is_request: false, archived_at: null }).eq("conversation_id", conversationId).eq("user_id", payload.senderId);
  reconcileLocalMessage(conversationId, row.local_id, message, !alreadySent);
  try { file.delete(); } catch { /* best-effort cleanup */ }
}

function isDuplicateUpload(error: unknown): boolean {
  const e = error as { statusCode?: unknown; message?: unknown } | null;
  return String(e?.statusCode) === "409" || /already exists|duplicate/i.test(String(e?.message ?? ""));
}

async function flushOutboxPost(row: OutboxRow) {
  const { posted_as_page_id, ...body } = JSON.parse(row.payload) as OutboxPostPayload;
  const { data, error } = posted_as_page_id
    ? await supabase.functions.invoke("create-page-post", { body: { ...body, page_id: posted_as_page_id } })
    : await supabase.functions.invoke("create-post", { body });
  if (error) throw error;
  // The function answered but refused the post (validation, moderation, limits): retrying can't help.
  if (data?.error) throw new OutboxPermanentError(String(data.error));
  // The post exists now. Nothing after this line may throw: a throw here would be classified as a
  // failed send and retried, publishing the post twice.
  await reconcileLocalPost(row.local_id);
}

async function countRows(where: string, params: (string | number)[] = []): Promise<number> {
  const userId = await currentUserId();
  if (!userId) return 0;
  const row = await safeDb((db) => db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM outbox WHERE user_id = ? AND ${where};`, [userId, ...params]));
  return row?.count ?? 0;
}

/** Items still on their way for the current user in one conversation (excludes ones that gave up). */
export function getPendingOutboxCount(conversationId: string): Promise<number> {
  return countRows("conversation_id = ? AND status = 'pending'", [conversationId]);
}

export function getTotalPendingOutboxCount(): Promise<number> {
  return countRows("status = 'pending'");
}

export function getPendingOutboxPostCount(): Promise<number> {
  return countRows("kind = 'post' AND status = 'pending'");
}

/** Items that gave up (dead-lettered) and are waiting for the user to retry or discard them. */
export function getFailedOutboxCount(): Promise<number> {
  return countRows("status = 'failed'");
}

/** Everything the current user hasn't got onto the server yet, pending or failed — for the sign-out confirmation. */
export function getUnsentOutboxCount(): Promise<number> {
  return countRows("1 = 1");
}

export type OutboxItem = { localId: string; kind: OutboxKind; conversationId: string | null; payload: unknown; createdAt: string; status: OutboxStatus; attempts: number; lastError: string | null };

/** The current user's queued items (pending and failed), oldest first — feeds pending-post cards and retry/discard UI. */
export async function listOutboxItems(kind?: OutboxKind): Promise<OutboxItem[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const rows = (await safeDb((db) =>
    kind
      ? db.getAllAsync<OutboxRow>("SELECT * FROM outbox WHERE user_id = ? AND kind = ? ORDER BY created_at ASC;", [userId, kind])
      : db.getAllAsync<OutboxRow>("SELECT * FROM outbox WHERE user_id = ? ORDER BY created_at ASC;", [userId])
  )) ?? [];
  return rows.map((row) => {
    let payload: unknown = null;
    try { payload = JSON.parse(row.payload); } catch { /* unreadable payload: surface the row anyway so it can be discarded */ }
    return { localId: row.local_id, kind: row.kind, conversationId: row.conversation_id, payload, createdAt: row.created_at, status: row.status, attempts: row.attempts, lastError: row.last_error };
  });
}

/** Puts a dead-lettered item back in the queue with a fresh attempt budget and sends it now. */
export async function retryOutboxItem(localId: string): Promise<void> {
  await safeDb((db) => db.runAsync("UPDATE outbox SET status = 'pending', attempts = 0, next_attempt_at = 0, last_error = NULL WHERE local_id = ? AND status = 'failed';", [localId]));
  emitOutboxChange();
  void flushOutbox();
}

export async function retryAllFailedOutbox(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await safeDb((db) => db.runAsync("UPDATE outbox SET status = 'pending', attempts = 0, next_attempt_at = 0, last_error = NULL WHERE user_id = ? AND status = 'failed';", [userId]));
  emitOutboxChange();
  void flushOutbox();
}

/** Drops a queued item for good: the row, a queued recording's local file, and the local bubble in its thread. */
export async function discardOutboxItem(localId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const row = await safeDb((db) => db.getFirstAsync<OutboxRow>("SELECT * FROM outbox WHERE local_id = ? AND user_id = ?;", [localId, userId]));
  if (!row) return;
  if (row.kind === "voice") {
    try { const { localUri } = JSON.parse(row.payload) as OutboxVoicePayload; const file = new File(localUri); if (file.exists) file.delete(); } catch { /* best-effort cleanup */ }
  }
  await safeDb((db) => db.runAsync("DELETE FROM outbox WHERE local_id = ?;", [localId]));
  if (row.conversation_id) {
    queryClient.setQueryData<Message[]>(["mobile-messages", row.conversation_id], (old) => (old ? old.filter((message) => message.id !== localId) : old));
  }
  emitOutboxChange();
}

function reconcileLocalMessage(conversationId: string, localId: string, serverMessage: Message, notify: boolean) {
  queryClient.setQueryData<Message[]>(["mobile-messages", conversationId], (old) =>
    (old ?? []).map((message) => (message.id === localId ? serverMessage : message))
  );
  void cacheMessages(conversationId, [serverMessage]);
  void queryClient.invalidateQueries({ queryKey: ["mobile-conversations"] });
  // Same call features/messaging/api.ts's notifyPush makes — inlined rather than
  // imported, since that module imports this one (import cycle). Skipped when an earlier
  // attempt already inserted the row (and so already notified), to avoid a double push.
  if (notify) void supabase.functions.invoke("send-message-push", { body: { message_id: serverMessage.id } }).catch((error) => console.warn("send-message-push failed", error));
}

// How long a just-sent post's placeholder may wait for the feed to refetch before the queue moves on.
const FEED_SETTLE_TIMEOUT_MS = 8_000;

async function reconcileLocalPost(localId: string): Promise<void> {
  // Feed pages are keyed by post id and read from the server on the next fetch anyway (unlike messages
  // there's no single small query key to patch in place across every feed variant). So drop the
  // placeholder by refetching, matching useCreatePost's own onSuccess invalidation. The outbox row (which
  // is what renders the placeholder) is deleted only after this returns, so the card stays until the real
  // post has landed in the feed rather than vanishing for a beat first.
  try {
    const refetch = Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["feed"] }),
      queryClient.invalidateQueries({ queryKey: ["identity-posts"] }),
    ]);
    await Promise.race([refetch, new Promise((resolve) => setTimeout(resolve, FEED_SETTLE_TIMEOUT_MS))]);
  } catch { /* the post is already sent; a failed refetch only means the feed catches up on its next fetch */ }
  if (__DEV__) console.log(`[outbox] flushed queued post ${localId}`);
}

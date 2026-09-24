// File: lib/local-cache.ts
import { safeDb } from "./sqlite";
import type { Message } from "@/features/messaging/api";

const MESSAGES_KEPT_PER_CONVERSATION = 100;
const PROFILE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // stale profile rows still render, just get pruned eventually

export type CachedProfile = { id: string; username: string; display_name: string; avatar_url: string | null; last_seen_at?: string | null };

export async function cacheProfiles(profiles: CachedProfile[]) {
  if (!profiles.length) return;
  await safeDb(async db => {
    const now = Date.now();
    await db.withTransactionAsync(async () => {
      for (const p of profiles) {
        await db.runAsync(
          `INSERT INTO profiles_cache (id, username, display_name, avatar_url, last_seen_at, cached_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET username=excluded.username, display_name=excluded.display_name,
             avatar_url=excluded.avatar_url, last_seen_at=excluded.last_seen_at, cached_at=excluded.cached_at;`,
          [p.id, p.username, p.display_name, p.avatar_url, p.last_seen_at ?? null, now],
        );
      }
    });
  });
}

export async function getCachedProfile(id: string): Promise<CachedProfile | undefined> {
  const row = await safeDb(async db =>
    db.getFirstAsync<CachedProfile>(
      "SELECT id, username, display_name, avatar_url, last_seen_at FROM profiles_cache WHERE id = ?;",
      [id],
    ),
  );
  return row ?? undefined;
}

export async function getCachedProfileByUsername(username: string): Promise<CachedProfile | undefined> {
  const row = await safeDb(async db =>
    db.getFirstAsync<CachedProfile>(
      "SELECT id, username, display_name, avatar_url, last_seen_at FROM profiles_cache WHERE username = ?;",
      [username],
    ),
  );
  return row ?? undefined;
}

export async function pruneStaleProfiles() {
  await safeDb(async db => db.runAsync("DELETE FROM profiles_cache WHERE cached_at < ?;", [Date.now() - PROFILE_TTL_MS]));
}

export async function cacheMessages(conversationId: string, messages: Message[]) {
  if (!messages.length) return;
  await safeDb(async db => {
    const now = Date.now();
    await db.withTransactionAsync(async () => {
      for (const m of messages) {
        await db.runAsync(
          `INSERT INTO messages_cache (id, conversation_id, sender_id, content, created_at, delivered_at, read_at, reply_to_message_id, is_deleted, cached_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET content=excluded.content, delivered_at=excluded.delivered_at,
             read_at=excluded.read_at, is_deleted=excluded.is_deleted, cached_at=excluded.cached_at;`,
          [m.id, m.conversation_id, m.sender_id, m.content, m.created_at, m.delivered_at, m.read_at, m.reply_to_message_id, m.is_deleted ? 1 : 0, now],
        );
      }
      // Keep only the most recent N rows per conversation so the cache doesn't grow unbounded.
      await db.runAsync(
        `DELETE FROM messages_cache WHERE conversation_id = ? AND id NOT IN (
           SELECT id FROM messages_cache WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?
         );`,
        [conversationId, conversationId, MESSAGES_KEPT_PER_CONVERSATION],
      );
    });
  });
}

export async function getCachedMessages(conversationId: string): Promise<Message[] | undefined> {
  const rows = await safeDb(async db =>
    db.getAllAsync<Omit<Message, "is_deleted"> & { is_deleted: number }>(
      "SELECT id, conversation_id, sender_id, content, created_at, delivered_at, read_at, reply_to_message_id, is_deleted FROM messages_cache WHERE conversation_id = ? ORDER BY created_at ASC;",
      [conversationId],
    ),
  );
  if (!rows?.length) return undefined;
  return rows.map(row => ({ ...row, is_deleted: !!row.is_deleted }));
}

// Signed URLs (currently just the private `audio` bucket) are requested with a 1hr TTL
// wherever they're created (see lib/media-cache.ts) — cache them keyed by storage path so
// a bubble scrolling in and out of view, or a replay, doesn't hit Supabase every time.
export async function getCachedSignedUrl(storagePath: string): Promise<string | undefined> {
  const row = await safeDb(async db =>
    db.getFirstAsync<{ url: string; expires_at: number }>(
      "SELECT url, expires_at FROM signed_urls_cache WHERE storage_path = ?;",
      [storagePath],
    ),
  );
  if (!row || row.expires_at <= Date.now()) return undefined;
  return row.url;
}

export async function cacheSignedUrl(storagePath: string, url: string, expiresAtMs: number) {
  await safeDb(db =>
    db.runAsync(
      `INSERT INTO signed_urls_cache (storage_path, url, expires_at) VALUES (?, ?, ?)
       ON CONFLICT(storage_path) DO UPDATE SET url = excluded.url, expires_at = excluded.expires_at;`,
      [storagePath, url, expiresAtMs],
    ),
  );
}

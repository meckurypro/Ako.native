// File: lib/sqlite.ts
// Local on-device cache. Backs five things:
//  - kv_cache: the persisted react-query cache (so screens paint from disk on cold start)
//  - profiles_cache: last-known profile rows (avatar_url, display_name, username, last_seen_at)
//  - messages_cache: last N messages per conversation, so chats open instantly offline
//  - signed_urls_cache: Supabase Storage signed URLs (currently just the private `audio`
//    bucket voice notes), so replaying/rescrolling a bubble doesn't re-request one every time
//  - outbox: writes composed while offline, retried once the network returns. Started out
//    chat-messages-only (kind='text', conversation_id required); v4 widened it to also queue
//    post creation (kind='post', conversation_id null); v5 scopes rows per user (user_id) and
//    adds retry bookkeeping (status, next_attempt_at) — see lib/outbox.ts.
//
// Everything here except `outbox` is a cache of one user's server data and is wiped whenever the
// signed-in user changes (resetLocalData, driven by lib/local-data.ts). `outbox` is user-scoped
// instead, so unsent items survive a sign-out and only ever flush for the account that made them.
import * as SQLite from "expo-sqlite";

const DB_NAME = "ako-cache.db";
const SCHEMA_VERSION = 5;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync("PRAGMA journal_mode = WAL;");
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion < SCHEMA_VERSION) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS kv_cache (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS profiles_cache (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT,
        display_name TEXT,
        avatar_url TEXT,
        last_seen_at TEXT,
        cached_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages_cache (
        id TEXT PRIMARY KEY NOT NULL,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        delivered_at TEXT,
        read_at TEXT,
        reply_to_message_id TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        cached_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_cache_conversation
        ON messages_cache (conversation_id, created_at);

      CREATE TABLE IF NOT EXISTS signed_urls_cache (
        storage_path TEXT PRIMARY KEY NOT NULL,
        url TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );

      -- Outbox: writes composed while offline. Each row is retried in order
      -- once the network comes back (see lib/outbox.ts). conversation_id is
      -- only set for kind='text'; kind='post' rows leave it null. A message
      -- stays visible in its thread, and a post in the feed, the whole time
      -- under its local id.
      CREATE TABLE IF NOT EXISTS outbox (
        local_id TEXT PRIMARY KEY NOT NULL,
        conversation_id TEXT,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        user_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        next_attempt_at INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Anyone upgrading from schema v3 already has an `outbox` table, so the
    // CREATE TABLE IF NOT EXISTS above was a no-op for them and it's still
    // sitting there with the old NOT NULL conversation_id. Recreate it in
    // place, carrying existing rows over (SQLite can't just drop a NOT NULL
    // constraint with ALTER TABLE).
    if (currentVersion > 0 && currentVersion < 4) {
      const outboxCols = await db.getAllAsync<{ name: string; notnull: number }>("PRAGMA table_info(outbox);");
      const conversationCol = outboxCols.find((col) => col.name === "conversation_id");
      if (conversationCol?.notnull) {
        await db.execAsync(`
          CREATE TABLE outbox_v4 (
            local_id TEXT PRIMARY KEY NOT NULL,
            conversation_id TEXT,
            kind TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_error TEXT
          );
          INSERT INTO outbox_v4 (local_id, conversation_id, kind, payload, created_at, attempts, last_error)
            SELECT local_id, conversation_id, kind, payload, created_at, attempts, last_error FROM outbox;
          DROP TABLE outbox;
          ALTER TABLE outbox_v4 RENAME TO outbox;
        `);
      }
    }

    // v5: per-user outbox + retry bookkeeping. Fresh installs already got these columns from the
    // CREATE TABLE above; upgraders add them in place. Text/voice rows are attributed from the
    // sender id stored in their payload. Post rows carry no owner, so there is no safe account to
    // flush them as (sending one as whoever signs in next would be worse than losing it) — drop them.
    if (currentVersion > 0 && currentVersion < 5) {
      const cols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(outbox);");
      const has = (name: string) => cols.some((col) => col.name === name);
      if (!has("user_id")) await db.execAsync("ALTER TABLE outbox ADD COLUMN user_id TEXT;");
      if (!has("status")) await db.execAsync("ALTER TABLE outbox ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';");
      if (!has("next_attempt_at")) await db.execAsync("ALTER TABLE outbox ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0;");
      await db.execAsync(`
        UPDATE outbox SET user_id = json_extract(payload, '$.senderId') WHERE user_id IS NULL AND kind IN ('text', 'voice');
        DELETE FROM outbox WHERE user_id IS NULL;
      `);
    }
    await db.execAsync("CREATE INDEX IF NOT EXISTS idx_outbox_user_status ON outbox (user_id, status, created_at);");

    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }
  return db;
}

// Single shared connection + open promise, so concurrent callers await the same init.
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

// Best-effort: cache reads/writes should never take down a screen. Callers use this
// instead of try/catch at every call site.
export async function safeDb<T>(fn: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T | undefined> {
  try {
    const db = await getDb();
    return await fn(db);
  } catch (error) {
    if (__DEV__) console.warn("[sqlite]", error);
    return undefined;
  }
}

// Caches that hold one user's server data. `outbox` is deliberately absent (it is user-scoped and
// must survive sign-out), and so is anything that isn't personal. Add new per-user cache tables
// here (e.g. an audio cache) so they are wiped together.
const USER_CACHE_TABLES = ["messages_cache", "profiles_cache", "signed_urls_cache", "kv_cache"] as const;

/**
 * Deletes every per-user cache row, including the persisted react-query copy (kv_cache) and the
 * cache-owner marker. Returns whether the wipe actually committed, so callers can retry rather
 * than assume. Callers should clear the in-memory query client themselves.
 */
export async function resetLocalData(): Promise<boolean> {
  const ok = await safeDb(async (db) => {
    await db.withTransactionAsync(async () => {
      for (const table of USER_CACHE_TABLES) await db.runAsync(`DELETE FROM ${table};`);
    });
    return true;
  });
  return ok === true;
}

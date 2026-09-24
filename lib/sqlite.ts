// File: lib/sqlite.ts
// Local on-device cache. Backs four things:
//  - kv_cache: the persisted react-query cache (so screens paint from disk on cold start)
//  - profiles_cache: last-known profile rows (avatar_url, display_name, username, last_seen_at)
//  - messages_cache: last N messages per conversation, so chats open instantly offline
//  - signed_urls_cache: Supabase Storage signed URLs (currently just the private `audio`
//    bucket voice notes), so replaying/rescrolling a bubble doesn't re-request one every time
import * as SQLite from "expo-sqlite";

const DB_NAME = "ako-cache.db";
const SCHEMA_VERSION = 2;

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
    `);
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

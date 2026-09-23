// File: lib/query-persister.ts
// Persists the whole react-query cache to SQLite (instead of AsyncStorage), so the
// list of conversations, recent messages, profiles, feed pages, etc. are available
// the instant the app opens — before any network round trip completes.
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { getDb, safeDb } from "./sqlite";

const CACHE_KEY = "REACT_QUERY_OFFLINE_CACHE";

export function createSQLitePersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await safeDb(async db => {
        const serialized = JSON.stringify(client);
        await db.runAsync(
          "INSERT INTO kv_cache (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;",
          [CACHE_KEY, serialized, Date.now()],
        );
      });
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      const row = await safeDb(async db =>
        db.getFirstAsync<{ value: string }>("SELECT value FROM kv_cache WHERE key = ?;", [CACHE_KEY]),
      );
      if (!row?.value) return undefined;
      try {
        return JSON.parse(row.value) as PersistedClient;
      } catch {
        return undefined;
      }
    },
    removeClient: async () => {
      await safeDb(async db => db.runAsync("DELETE FROM kv_cache WHERE key = ?;", [CACHE_KEY]));
    },
  };
}

// One-time init so the db file + tables exist before the persister's first read.
export const sqliteReady = getDb();

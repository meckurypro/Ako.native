// File: lib/local-data.ts
// Keeps the on-device caches (messages_cache, profiles_cache, signed_urls_cache and the persisted
// react-query cache) from leaking between accounts. The cache remembers which user it belongs to;
// whenever the signed-in user differs — sign-out, account switch, or a fresh sign-in as someone
// else, in any order and even if the app was killed mid-way — it is wiped before the new user's
// data can land in it. Driven from AuthProvider so no call site needs to remember to do it.
import { resetLocalData, safeDb } from "./sqlite";

const OWNER_KEY = "local_data_owner";

let chain: Promise<unknown> = Promise.resolve();

async function readOwner(): Promise<string | null> {
  const row = await safeDb((db) => db.getFirstAsync<{ value: string }>("SELECT value FROM kv_cache WHERE key = ?;", [OWNER_KEY]));
  return row?.value ?? null;
}

async function writeOwner(userId: string) {
  await safeDb((db) =>
    db.runAsync(
      "INSERT INTO kv_cache (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;",
      [OWNER_KEY, userId, Date.now()]
    )
  );
}

/**
 * Makes the local caches belong to `userId` (or to nobody, when null = signed out), wiping them if
 * they belonged to someone else. `treatUnownedAsStale` is for the first check after launch: a
 * cache with no owner marker predates this logic (or a wipe was interrupted), so its owner is
 * unknown and it is discarded rather than trusted. Resolves true if a wipe happened.
 * Calls are serialised so a quick sign-out/sign-in can't interleave two wipes.
 */
export function reconcileLocalDataOwner(userId: string | null, options: { treatUnownedAsStale: boolean }): Promise<boolean> {
  const run = chain.then(async () => {
    const owner = await readOwner();
    const hasData = owner !== null || options.treatUnownedAsStale;
    const mustWipe = userId === null ? hasData : owner !== null ? owner !== userId : options.treatUnownedAsStale;
    let wiped = false;
    if (mustWipe) {
      wiped = await resetLocalData();
      if (!wiped) return false; // couldn't wipe: don't claim the cache for this user; the next check retries
    }
    if (userId && (wiped || owner !== userId)) await writeOwner(userId);
    return wiped;
  });
  chain = run.catch(() => undefined);
  return run;
}

// File: lib/db-encryption.ts
// Encryption at rest for the local cache database (SQLCipher, via expo-sqlite's `useSQLCipher`
// config plugin option — see app.config.ts).
//
// Threat model: a lost / stolen / forensically imaged device, or a backup extracted off it. The file
// holds cached chats, profiles and the unsent-items outbox, so it must not be readable without the key.
// It does NOT defend against malware running as the app, or against someone who can unlock the device
// (the key is deliberately not behind biometrics — the app-lock gate is a separate, UI-level control).
//
// Key handling (the parts that matter):
//  - 256 bits from the OS CSPRNG (expo-crypto), generated once per install, kept in SecureStore
//    (iOS Keychain / Android Keystore-backed). Never logged, never in JS storage, never sent anywhere.
//  - Stored `*_THIS_DEVICE_ONLY`: it never rides along in a backup or device-to-device transfer, so a
//    restored database file without its key is unreadable by design (handled below: recreate).
//  - Passed as a raw hex key (`x'…'`). A 256-bit random key needs no passphrase stretching, and skipping
//    the KDF keeps every open fast.
//
// Failure policy — decided per failure, on purpose:
//  - SecureStore can't be read (device locked, Keystore hiccup): throw and change nothing. That is
//    transient; wiping the database because a read failed would destroy the user's unsent items.
//  - SQLCipher isn't actually in this binary: throw. Silently continuing would leave a plaintext database
//    that the code believes is encrypted. (Needs a native rebuild after the config change; Expo Go can't.)
//  - Key is fine but the file won't open with it (key lost, backup restore, corruption): the data is
//    unrecoverable, so delete and recreate. Everything except the outbox is a re-fetchable cache.
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { File } from "expo-file-system";
import { getRandomBytes } from "expo-crypto";

export const ENCRYPTED_DB_NAME = "ako-cache-v2.db";
// The pre-encryption database. Never opened again once migrated; deleted after a verified copy.
const LEGACY_DB_NAME = "ako-cache.db";

const KEY_NAME = "ako-db-key-v1";
const KEY_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
const HEX_KEY = /^[0-9a-f]{64}$/;
const SIDECARS = ["", "-wal", "-shm", "-journal"] as const;

function newKeyHex(): string {
  return Array.from(getRandomBytes(32), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadOrCreateKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_NAME, KEY_OPTIONS); // throws on a real read failure: see header
  if (existing && HEX_KEY.test(existing)) return existing;
  const created = newKeyHex();
  await SecureStore.setItemAsync(KEY_NAME, created, KEY_OPTIONS);
  return created;
}

async function replaceKey(): Promise<string> {
  const created = newKeyHex();
  await SecureStore.setItemAsync(KEY_NAME, created, KEY_OPTIONS);
  return created;
}

const dbDirectory = (): string => SQLite.defaultDatabaseDirectory as string;
const asFileUri = (path: string): string => (path.startsWith("file://") ? path : `file://${path}`);
const dbFile = (name: string, suffix = "") => new File(asFileUri(dbDirectory()), `${name}${suffix}`);
const dbFileExists = (name: string): boolean => { try { return dbFile(name).exists; } catch { return false; } };
const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/** Removes a database file and its WAL/shared-memory/journal sidecars. Best-effort. */
async function removeDatabaseFiles(name: string): Promise<void> {
  await SQLite.deleteDatabaseAsync(name).catch(() => {});
  for (const suffix of SIDECARS) {
    try { const file = dbFile(name, suffix); if (file.exists) file.delete(); } catch { /* best-effort */ }
  }
}

async function userVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  return row?.user_version ?? 0;
}

/** Opens `name` with the key; null if the key doesn't decrypt it. Throws if SQLCipher isn't in this build. */
async function openKeyed(name: string, keyHex: string): Promise<SQLite.SQLiteDatabase | null> {
  const db = await SQLite.openDatabaseAsync(name);
  try {
    const cipher = await db.getFirstAsync<{ cipher_version: string }>("PRAGMA cipher_version;");
    if (!cipher?.cipher_version) throw new Error("SQLCipher is not available in this build; rebuild the native app.");
  } catch (error) {
    await db.closeAsync().catch(() => {});
    throw error;
  }
  try {
    // keyHex is validated hex, so interpolating it cannot inject SQL. PRAGMA key can't be parameterised.
    await db.execAsync(`PRAGMA key = "x'${keyHex}'";`);
    await db.getFirstAsync("SELECT count(*) AS n FROM sqlite_master;"); // first real read: fails if the key is wrong
    return db;
  } catch {
    await db.closeAsync().catch(() => {});
    return null;
  }
}

/**
 * One-time move of the old plaintext database into the encrypted one. Safe to interrupt at any point:
 * the encrypted file's `user_version` is only set after the copy finishes, so it doubles as the
 * "complete" marker, an unfinished copy is simply redone, and the plaintext file is only deleted once a
 * re-opened copy has been checked. The schema (and its version) comes across intact, so the normal
 * upgrade steps in lib/sqlite.ts still run afterwards on the encrypted copy.
 */
async function migrateLegacyDatabase(keyHex: string): Promise<void> {
  let sourceVersion = 0;
  let complete = false;

  if (dbFileExists(ENCRYPTED_DB_NAME)) {
    const probe = await openKeyed(ENCRYPTED_DB_NAME, keyHex);
    if (probe) {
      complete = (await userVersion(probe)) > 0;
      await probe.closeAsync();
    }
  }

  if (!complete) {
    await removeDatabaseFiles(ENCRYPTED_DB_NAME); // a partial or foreign leftover
    const source = await SQLite.openDatabaseAsync(LEGACY_DB_NAME);
    try {
      sourceVersion = await userVersion(source);
      if (sourceVersion > 0) {
        const target = `${dbDirectory().replace(/\/$/, "")}/${ENCRYPTED_DB_NAME}`;
        await source.execAsync(`ATTACH DATABASE ${sqlString(target)} AS encrypted KEY "x'${keyHex}'";`);
        await source.execAsync("SELECT sqlcipher_export('encrypted');");
        await source.execAsync(`PRAGMA encrypted.user_version = ${sourceVersion};`); // commit marker: last
        await source.execAsync("DETACH DATABASE encrypted;");
      }
    } finally {
      await source.closeAsync().catch(() => {});
    }
    if (sourceVersion > 0) {
      const check = await openKeyed(ENCRYPTED_DB_NAME, keyHex);
      const ok = check !== null && (await userVersion(check)) === sourceVersion;
      await check?.closeAsync().catch(() => {});
      if (!ok) throw new Error("Encrypted copy of the local database did not verify; keeping the old one for the next launch.");
    }
  }

  await removeDatabaseFiles(LEGACY_DB_NAME);
}

/** Opens (creating, migrating or — only when unrecoverable — recreating) the encrypted cache database. */
export async function openEncryptedDatabase(): Promise<SQLite.SQLiteDatabase> {
  let keyHex = await loadOrCreateKey();
  if (dbFileExists(LEGACY_DB_NAME)) await migrateLegacyDatabase(keyHex);

  let db = await openKeyed(ENCRYPTED_DB_NAME, keyHex);
  if (!db) {
    // The key is readable but doesn't open the file: lost/replaced key, a database restored without its
    // device-only key, or corruption. Nothing can decrypt it, so start clean with a fresh key.
    console.warn("[sqlite] local database could not be decrypted; recreating it");
    await removeDatabaseFiles(ENCRYPTED_DB_NAME);
    keyHex = await replaceKey();
    db = await openKeyed(ENCRYPTED_DB_NAME, keyHex);
    if (!db) throw new Error("Could not open a new encrypted local database.");
  }
  return db;
}

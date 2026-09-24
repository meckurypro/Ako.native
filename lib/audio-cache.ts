// File: lib/audio-cache.ts
// On-device copies of voice notes, so a note you've already played (or sent) replays instantly, on
// any connection, instead of re-streaming it from a signed URL every time. lib/media-cache.ts already
// caches the signed URL itself; this caches the audio bytes behind it.
//
// Storage: files under the app cache directory (the OS may reclaim those when space is short, so every
// read verifies the file still exists), plus an index — storage path -> file, size, last-used — kept in
// the same SQLite kv_cache table as the rest of the per-account caches, so it is wiped with them.
//
// Privacy rules that shape the design:
//  - View-once notes are never cached (callers pass nothing for them; see VoiceNote). Keeping the bytes
//    of a note that's meant to be heard once would defeat the point.
//  - The audio bucket is private. Files here belong to whichever account played them, so
//    clearAudioCache() runs when the signed-in user changes (lib/local-data.ts) and a launch-time
//    sweep removes anything the index doesn't know about.
//  - Bounded: least-recently-used files are evicted past MAX_BYTES / MAX_FILES.
import { Directory, File, Paths } from "expo-file-system";
import { safeDb } from "./sqlite";

const DIR_NAME = "voice-notes";
const INDEX_KEY = "audio_cache_index";
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 300;
const TOUCH_PERSIST_DELAY_MS = 2000;

type Entry = { file: string; bytes: number; lastUsed: number };
type Index = Record<string, Entry>;

let indexPromise: Promise<Index> | null = null;
let touchTimer: ReturnType<typeof setTimeout> | null = null;
// Bumped by clearAudioCache(). A download that started before a clear must not register its file
// afterwards — it belongs to the account that was just signed out.
let generation = 0;
const downloads = new Map<string, Promise<string | null>>();

function directory(): Directory {
  const dir = new Directory(Paths.cache, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Storage paths look like `<user>/dm/<conversation>/<id>.m4a`; flatten to one safe file name, keeping the tail (and extension). */
function fileNameFor(path: string): string {
  const flat = path.replace(/[^A-Za-z0-9._-]/g, "_");
  return flat.length > 180 ? flat.slice(-180) : flat;
}

function loadIndex(): Promise<Index> {
  indexPromise ??= (async () => {
    const row = await safeDb((db) => db.getFirstAsync<{ value: string }>("SELECT value FROM kv_cache WHERE key = ?;", [INDEX_KEY]));
    if (!row) return {};
    try {
      const parsed = JSON.parse(row.value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Index) : {};
    } catch {
      return {};
    }
  })();
  return indexPromise;
}

async function persistIndex(index: Index): Promise<void> {
  await safeDb((db) =>
    db.runAsync(
      "INSERT INTO kv_cache (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;",
      [INDEX_KEY, JSON.stringify(index), Date.now()],
    ),
  );
}

/** "Last used" changes on every play; batch those writes instead of hitting SQLite each time. */
function persistSoon(index: Index): void {
  if (touchTimer) return;
  touchTimer = setTimeout(() => { touchTimer = null; void persistIndex(index); }, TOUCH_PERSIST_DELAY_MS);
}

function removeFile(name: string): void {
  try {
    const file = new File(directory(), name);
    if (file.exists) file.delete();
  } catch { /* best-effort */ }
}

/** Drops least-recently-used entries until the cache fits its byte and file limits. */
function evictIfNeeded(index: Index, keep: string): void {
  const paths = Object.keys(index);
  let total = paths.reduce((sum, path) => sum + index[path].bytes, 0);
  let count = paths.length;
  if (total <= MAX_BYTES && count <= MAX_FILES) return;
  const oldestFirst = paths.filter((path) => path !== keep).sort((a, b) => index[a].lastUsed - index[b].lastUsed);
  for (const path of oldestFirst) {
    if (total <= MAX_BYTES && count <= MAX_FILES) break;
    total -= index[path].bytes;
    count -= 1;
    removeFile(index[path].file);
    delete index[path];
  }
}

async function register(path: string, name: string, bytes: number): Promise<void> {
  const index = await loadIndex();
  index[path] = { file: name, bytes, lastUsed: Date.now() };
  evictIfNeeded(index, path);
  await persistIndex(index);
}

/** A local file:// URI for this voice note if it has been cached and the file is still there, else null. */
export async function getCachedAudioUri(path: string): Promise<string | null> {
  try {
    const index = await loadIndex();
    const entry = index[path];
    if (!entry) return null;
    const file = new File(directory(), entry.file);
    if (!file.exists) {
      // The OS reclaimed it (or it was removed some other way): forget the entry.
      delete index[path];
      persistSoon(index);
      return null;
    }
    entry.lastUsed = Date.now();
    persistSoon(index);
    return file.uri;
  } catch {
    return null;
  }
}

/**
 * Downloads the audio behind a signed URL into the cache. Fire-and-forget from the caller's side:
 * concurrent requests for the same note share one download, an already-cached note is a no-op, and any
 * failure just means the note streams next time too. Resolves to the cached file URI, or null.
 */
export function cacheAudioFromUrl(path: string, signedUrl: string): Promise<string | null> {
  const inFlight = downloads.get(path);
  if (inFlight) return inFlight;
  const job = (async (): Promise<string | null> => {
    const startedIn = generation;
    const name = fileNameFor(path);
    try {
      const already = await getCachedAudioUri(path);
      if (already) return already;
      const dir = directory();
      // Download beside the final name and rename when complete: on Android a failed download can leave
      // a partial file at the destination, and a half-written note must never be served as a cached one.
      const part = new File(dir, `${name}.part`);
      if (part.exists) part.delete();
      await File.downloadFileAsync(signedUrl, part, { idempotent: true });
      if (generation !== startedIn || !part.exists || !part.size) { removeFile(`${name}.part`); return null; }
      const finished = new File(dir, name);
      if (finished.exists) finished.delete();
      part.move(finished);
      await register(path, name, finished.size ?? part.size ?? 0);
      return finished.uri;
    } catch {
      removeFile(`${name}.part`);
      return null;
    } finally {
      downloads.delete(path);
    }
  })();
  downloads.set(path, job);
  return job;
}

/**
 * Files a recording you sent under its storage path so replaying your own note needs no download.
 * The copy happens synchronously (before the first await), so a caller may delete `localUri` right after.
 */
export async function adoptAudioFile(path: string, localUri: string): Promise<void> {
  const startedIn = generation;
  const name = fileNameFor(path);
  let bytes = 0;
  try {
    const source = new File(localUri);
    if (!source.exists) return;
    const target = new File(directory(), name);
    if (target.exists) target.delete();
    source.copy(target);
    bytes = target.size ?? source.size ?? 0;
  } catch {
    return;
  }
  if (generation !== startedIn) { removeFile(name); return; }
  await register(path, name, bytes);
}

/** Deletes every cached voice note and forgets the index. Called when the signed-in account changes. */
export async function clearAudioCache(): Promise<void> {
  generation += 1;
  if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
  indexPromise = Promise.resolve({});
  try {
    const dir = new Directory(Paths.cache, DIR_NAME);
    if (dir.exists) dir.delete();
  } catch { /* best-effort */ }
  await safeDb((db) => db.runAsync("DELETE FROM kv_cache WHERE key = ?;", [INDEX_KEY]));
}

/**
 * Once per launch: remove files the index doesn't reference (left by a wipe that was interrupted, an
 * app kill mid-download, or a cleared index) and index entries whose file has gone.
 */
export async function sweepAudioCache(): Promise<void> {
  try {
    const index = await loadIndex();
    const dir = directory();
    const known = new Set(Object.values(index).map((entry) => entry.file));
    let changed = false;
    for (const item of dir.list()) {
      if (!(item instanceof File)) continue;
      const name = item.uri.split("/").pop() ?? "";
      const isPartial = name.endsWith(".part");
      if (isPartial ? downloads.size === 0 : !known.has(name)) { try { item.delete(); } catch { /* best-effort */ } }
    }
    for (const path of Object.keys(index)) {
      if (!new File(dir, index[path].file).exists) { delete index[path]; changed = true; }
    }
    if (changed) await persistIndex(index);
  } catch { /* best-effort */ }
}

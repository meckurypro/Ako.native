// File: features/messaging/voicePlaybackPosition.ts
//
// Remembers how far into each voice note the listener got, so reopening a
// chat — or scrolling a bubble back into view after FlatList virtualization
// unmounts and remounts it — resumes near where they left off instead of
// restarting from 0. Backed by AsyncStorage so it survives app restarts;
// an in-memory cache makes reads synchronous for the common case (already
// loaded this session).
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "ako:voice-note-positions";
const MAX_ENTRIES = 300; // oldest-inserted entries are dropped past this

let cache: Record<string, number> | null = null;
let loading: Promise<Record<string, number>> | null = null;

async function loadCache(): Promise<Record<string, number>> {
  if (cache) return cache;
  if (!loading) {
    loading = AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => (raw ? (JSON.parse(raw) as Record<string, number>) : {}))
      .catch(() => ({}))
      .then(value => (cache = value));
  }
  return loading;
}

// Fire-and-forget warmup so getVoicePlaybackPosition can answer synchronously
// for messages that render on first paint. Call once, near app start.
export function primeVoicePlaybackPositions() {
  void loadCache();
}

export function getVoicePlaybackPosition(messageId: string): number {
  return cache?.[messageId] ?? 0;
}

export function saveVoicePlaybackPosition(messageId: string, seconds: number) {
  void loadCache().then(current => {
    const next = { ...current, [messageId]: seconds };
    const keys = Object.keys(next);
    if (keys.length > MAX_ENTRIES) {
      // Object key order is insertion order for string keys in JS, so this
      // drops the oldest entries first.
      for (const key of keys.slice(0, keys.length - MAX_ENTRIES)) delete next[key];
    }
    cache = next;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  });
}

// Used when the on-device caches are wiped for a different account: message ids are private to the
// account that heard them, and the persisted map would otherwise outlive the sign-out.
export async function clearVoicePlaybackPositions() {
  cache = {};
  loading = null;
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

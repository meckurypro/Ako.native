// File: lib/media-cache.ts
import { Image } from "expo-image";
import { supabase } from "./supabase";
import { cacheSignedUrl, getCachedSignedUrl } from "./local-cache";

// Matches the TTL VoiceNote.tsx has always requested signed URLs with.
// Refresh a little before actual expiry so a slow network doesn't hand back
// a URL that dies mid-request, and dedupe concurrent requests for the same
// path (two bubbles for the same forwarded voice note, a fast re-render)
// so they don't both round-trip to Supabase.
const AUDIO_SIGNED_URL_TTL_SECONDS = 3600;
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

const inFlight = new Map<string, Promise<string | null>>();

/**
 * Returns a signed URL for a path in the private `audio` bucket, preferring
 * a cached one (lib/sqlite.ts's signed_urls_cache table) that isn't near
 * expiry. This is what makes replaying a voice note, or scrolling one back
 * into view, skip the network round trip it used to make every single time.
 */
export async function getSignedAudioUrl(path: string): Promise<string | null> {
  const cached = await getCachedSignedUrl(path);
  if (cached) return cached;
  const pending = inFlight.get(path);
  if (pending) return pending;
  const request = (async () => {
    try {
      const { data, error } = await supabase.storage.from("audio").createSignedUrl(path, AUDIO_SIGNED_URL_TTL_SECONDS);
      if (error || !data?.signedUrl) return null;
      const expiresAt = Date.now() + AUDIO_SIGNED_URL_TTL_SECONDS * 1000 - EXPIRY_SAFETY_MARGIN_MS;
      void cacheSignedUrl(path, data.signedUrl, expiresAt);
      return data.signedUrl;
    } finally {
      inFlight.delete(path);
    }
  })();
  inFlight.set(path, request);
  return request;
}

/**
 * Fire-and-forget prefetch of a batch of image URLs into expo-image's disk
 * cache, so they've usually already finished downloading by the time the
 * real <Image> mounts (e.g. Avatar.tsx and PostCard's media already use
 * cachePolicy="disk", so a prefetched image is a guaranteed cache hit).
 * Falsy/duplicate URLs are dropped; failures are swallowed — this is a
 * speed optimization, never something a screen should block on or surface
 * an error for.
 */
export function prefetchImages(urls: readonly (string | null | undefined)[]): void {
  const unique = Array.from(new Set(urls.filter((url): url is string => !!url)));
  if (!unique.length) return;
  void Image.prefetch(unique, { cachePolicy: "disk" }).catch(() => {});
}

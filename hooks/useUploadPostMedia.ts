// File: hooks/useUploadPostMedia.ts
// Partial port of web's src/hooks/useUploadPostMedia.ts — isVideoUrl
// only for now. The actual upload mutation there uses browser-only
// APIs (File, createImageBitmap) with no native equivalent; that half
// ports alongside Compose, using expo-image-picker + a native-safe
// decodability check instead.
//
// Video removed from posts going forward (posts are text, images, or
// slides only) — kept here because posts uploaded before that
// restriction may still carry a video URL in media_urls, and those
// need to keep rendering (see PostMedia.tsx).
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url);
}

// File: lib/post-media.ts
// Upload of a picked image to the public `post-media` bucket. Shared by the composer's online path
// (features/compose/api.ts) and the outbox (lib/outbox.ts), which uploads photos attached to a post
// that was written offline once the network is back.
import { File } from "expo-file-system";
import { supabase } from "./supabase";

export type PostImageAsset = { uri: string; mimeType?: string | null; fileName?: string | null; fileSize?: number | null };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 50 * 1024 * 1024;

/** Throws the same user-facing messages the composer has always shown. */
export function validatePostImage(asset: PostImageAsset): void {
  if (!ALLOWED_TYPES.includes(asset.mimeType ?? "")) throw new Error("Choose a JPEG, PNG, WebP, or GIF image.");
  if ((asset.fileSize ?? 0) > MAX_BYTES) throw new Error("Each image must be under 50MB.");
}

export function postImageExtension(asset: PostImageAsset): string {
  return (asset.fileName?.split(".").pop() || (asset.mimeType ?? "").split("/")[1] || "jpg").toLowerCase();
}

function isDuplicateUpload(error: unknown): boolean {
  const e = error as { statusCode?: unknown; message?: unknown } | null;
  return String(e?.statusCode) === "409" || /already exists|duplicate/i.test(String(e?.message ?? ""));
}

/**
 * Uploads the image and returns its public URL. Without `options.path` the object gets a random name
 * (the composer's normal case). With one, the name is fixed by the caller, so a retry after a lost
 * response finds the object already there and returns its URL instead of failing or duplicating it.
 */
export async function uploadPostImage(userId: string, asset: PostImageAsset, options: { path?: string } = {}): Promise<string> {
  validatePostImage(asset);
  const type = asset.mimeType ?? "";
  const bytes = await new File(asset.uri).arrayBuffer();
  if (bytes.byteLength === 0) throw new Error("The selected image could not be read. Please choose it again.");
  const path = options.path ?? `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${postImageExtension(asset)}`;
  const { error } = await supabase.storage.from("post-media").upload(path, bytes, { contentType: type, upsert: false });
  if (error && !(options.path && isDuplicateUpload(error))) throw error;
  return supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
}

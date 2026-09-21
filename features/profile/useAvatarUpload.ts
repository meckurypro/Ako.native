import { useMutation, useQueryClient } from "@tanstack/react-query";
import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function useAvatarUpload() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (asset: ImagePickerAsset) => {
      if (!user) throw new Error("Not signed in");
      if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) throw new Error("Image must be under 5MB.");
      if (asset.mimeType && !ALLOWED_TYPES.has(asset.mimeType)) throw new Error("Choose a JPEG, PNG, WebP or GIF image.");

      const prepared = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
      );
      const bytes = await new File(prepared.uri).arrayBuffer();
      if (bytes.byteLength === 0) throw new Error("The selected image could not be read. Please choose it again.");
      if (bytes.byteLength > MAX_FILE_SIZE) throw new Error("Prepared image is still over 5MB.");

      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);
      if (updateError) {
        await supabase.storage.from("avatars").remove([path]);
        throw updateError;
      }

      await refreshProfile();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["own-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
      ]);
      return data.publicUrl;
    },
  });
}

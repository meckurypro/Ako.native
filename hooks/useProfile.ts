// File: hooks/useProfile.ts
//
// useMyProfile + the always-personal follow hooks (useIsFollowing /
// useToggleFollow — what onboarding's Find People step needs). The rest of
// web's useProfile.ts (user posts, identity-aware follow, followers lists,
// profile edits) ports with the Profile screen.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export interface MyProfileSummary {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export function useMyProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async (): Promise<MyProfileSummary> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useIsFollowing(targetUserId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-following", targetUserId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!targetUserId,
  });
}

/**
 * Toggles a follow on/off for the SIGNED-IN PERSON — always writes to
 * `follows`, never page_follows_target, regardless of active identity.
 * Right for flows that are unambiguously personal (onboarding's Find
 * People, reached before any page can exist); the identity-aware variant
 * comes with the card-level FollowButton.
 *
 * Web also plays a "follow" sound on success (useSound) — native has no
 * sound layer yet, so that's omitted.
 */
export function useToggleFollow(targetUserId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (currentlyFollowing: boolean) => {
      if (!user) throw new Error("Not signed in");

      if (currentlyFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: targetUserId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-following", targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["is-followed-by", targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["followers"] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
    },
  });
}

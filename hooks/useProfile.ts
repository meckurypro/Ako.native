// File: hooks/useProfile.ts
//
// useMyProfile + the follow hooks: the always-personal pair (useIsFollowing /
// useToggleFollow — what onboarding's Find People step needs) and the
// identity-aware ones the card-level FollowButton uses
// (useIsFollowedByUser / useIsFollowingAsActiveIdentity /
// useToggleFollowAsActiveIdentity). The rest of web's useProfile.ts (user
// posts, followers lists, profile edits) ports with the Profile screen.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { useActiveIdentity } from "./usePages";
import { useSound } from "./useSound";

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

/**
 * The reverse of useIsFollowing: does targetUserId follow ME. Powers
 * "Follow back" (I don't follow them, but they follow me) and the
 * mutual-follow "you and X are friends" unfollow reminder (I follow
 * them AND they follow me).
 */
export function useIsFollowedByUser(targetUserId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-followed-by", targetUserId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", targetUserId)
        .eq("following_id", user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!targetUserId,
  });
}

/**
 * Follow-state check that's aware of the CURRENT acting identity —
 * personal account, or a page. Reads the matching table so a page's
 * own follow button state doesn't show "Following" just because the
 * team member behind it personally follows that profile (or vice
 * versa). See sql/29_page_identity_engagement.sql for page_follows_target.
 */
export function useIsFollowingAsActiveIdentity(targetUserId: string) {
  const { user } = useAuth();
  const { data: identity } = useActiveIdentity();
  const actingAsPageId = identity?.mode === "page" ? identity.page.id : null;

  return useQuery({
    queryKey: ["is-following-as-identity", targetUserId, user?.id, actingAsPageId],
    queryFn: async () => {
      if (!user) return false;

      if (actingAsPageId) {
        const { data } = await supabase
          .from("page_follows_target")
          .select("page_id")
          .eq("page_id", actingAsPageId)
          .eq("followed_profile_id", targetUserId)
          .maybeSingle();
        return !!data;
      }

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
 * Toggles a follow as whichever identity is currently active — the
 * signed-in person if in Personal mode, or the page if in Page mode.
 * This is the fix for item 7: previously every follow, everywhere in
 * the app (including from inside a post/project card while acting as
 * a page), went through useToggleFollow above and landed on the
 * team member's own personal `follows` row no matter what. Now used
 * by both FollowButton.tsx (the compact card control) AND
 * ProfilePage's main Follow/Unfollow button — the personal and page
 * follow relationships are stored in separate tables (follows vs
 * page_follows_target), so switching identity was never a data
 * problem, only a "which table is this screen reading/writing right
 * now" one. Each identity's own follow state is exactly where it was
 * the moment you switch back to it.
 */
export function useToggleFollowAsActiveIdentity(targetUserId: string) {
  const { user } = useAuth();
  const { data: identity } = useActiveIdentity();
  const actingAsPageId = identity?.mode === "page" ? identity.page.id : null;
  const queryClient = useQueryClient();
  const { play } = useSound();

  return useMutation({
    mutationFn: async (currentlyFollowing: boolean) => {
      if (!user) throw new Error("Not signed in");

      if (actingAsPageId) {
        if (currentlyFollowing) {
          const { error } = await supabase
            .from("page_follows_target")
            .delete()
            .eq("page_id", actingAsPageId)
            .eq("followed_profile_id", targetUserId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("page_follows_target")
            .insert({ page_id: actingAsPageId, followed_profile_id: targetUserId });
          if (error) throw error;
        }
        return;
      }

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
    onSuccess: (_data, currentlyFollowing) => {
      if (!currentlyFollowing) play("follow");

      queryClient.invalidateQueries({ queryKey: ["is-following-as-identity", targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["is-following", targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["followers"] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
      if (actingAsPageId) {
        queryClient.invalidateQueries({ queryKey: ["page", actingAsPageId] });
        queryClient.invalidateQueries({ queryKey: ["my-pages"] });
      }
    },
  });
}

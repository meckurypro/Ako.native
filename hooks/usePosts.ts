// File: hooks/usePosts.ts
//
// Feed-reading slice of web's src/hooks/usePosts.ts: FEED_SELECT,
// normalizePost, the three feed tabs (For You / Following / Top
// Discussions), the topic-filtered feed, and usePostById. It's plain
// supabase-js + react-query, so the query bodies are identical to web —
// same RPCs (get_ranked_feed, get_following_feed, get_trending_feed,
// fulfill_gift_tokens), same query keys, same PAGE_SIZE.
//
// Deliberately NOT ported yet — port alongside the screens that use them:
//   - mutations: useCreatePost, useCreateReshare, useUpdatePost,
//     useDeletePost, useSetPostArchived, usePrioritizePost, and the
//     draft/scheduled helpers (these also pull in functionErrors and
//     debugFlags, which don't exist here yet)
//   - canEditPost / POST_EDIT_WINDOW_MS
//   - usePagePosts, useHasReshared, usePostViewCount, usePostTopics,
//     usePrioritizedPostToday, useUserPostsWithArchived
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { PROFILE_ROLES_SELECT, toProfileRoles } from "../lib/profileRoles";
import { PAGE_SELECT } from "../lib/postSelects";
import type { PostWithAuthor, RepostSource } from "../types/database";

const PAGE_SIZE = 15;

const AUTHOR_SELECT = `id, username, display_name, avatar_url, tier, is_private, is_verified, ${PROFILE_ROLES_SELECT}`;
// Joined alongside author on every post select — null on the vast
// majority of rows (personal posts), populated only when the post was
// published in Page mode. PostCard should prefer this over `author`
// for byline/avatar whenever it's non-null.
// Item 10 — the tagged project's card-preview fields only (not `*`):
// this rides along on every single post fetch in the feed, so keeping
// it to what TaggedProjectEmbed.tsx actually renders (thumbnail,
// title, type, price, status, owner byline) matters for payload size
// on a feed page of 15 posts.
const TAGGED_PROJECT_SELECT = `tagged_project:projects!posts_tagged_project_id_fkey(id, title, thumbnail_url, project_type, price_usd, promo_price_usd, status, slug, owner:profiles!projects_owner_id_fkey(username, display_name), posted_as_page:pages(username))`;

// One level deep: the embedded reshared_post carries its own author but
// not a further-nested reshared_post, so repost-of-a-repost links to the
// immediate parent rather than recursing indefinitely.
export const FEED_SELECT = `*, author:profiles!posts_author_id_fkey(${AUTHOR_SELECT}), ${PAGE_SELECT}, ${TAGGED_PROJECT_SELECT}, reshared_post(*, author:profiles!posts_author_id_fkey(${AUTHOR_SELECT}))`;

function normalizeAuthor(raw: any) {
  return raw ? { ...raw, roles: toProfileRoles(raw.profile_roles) } : raw;
}

/** Normalises the raw Supabase shape → PostWithAuthor (flattens profile_roles → roles). */
export function normalizePost(raw: any): PostWithAuthor {
  if (!raw) throw new Error("No post data to normalize.");
  const reshared_post: RepostSource | null | undefined = raw.reshared_post
    ? { ...raw.reshared_post, author: normalizeAuthor(raw.reshared_post.author) }
    : raw.reshared_post;

  return {
    ...raw,
    author: normalizeAuthor(raw.author),
    reshared_post,
  };
}

/**
 * The personalized "For You" ranking — calls get_ranked_feed (see
 * feed_algorithm_ranking_function.sql) which blends following,
 * topic relevance, social relevance, and Prioritize/gift-token
 * substitution into a single scored order, then fetches the full
 * rows for the returned ids (RPC only returns post_id + score,
 * .in() doesn't preserve order so it's re-sorted client-side to
 * match). Once the page renders, fulfill_gift_tokens is fired to
 * consume any gift tokens whose prioritized post was just served —
 * a separate call, not baked into the (read-only/STABLE) ranking
 * function itself.
 */
function useRankedFeed(page: number, enabled: boolean) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["feed-posts", "ranked", user?.id, page],
    queryFn: async (): Promise<PostWithAuthor[]> => {
      if (!user) return [];

      const { data: ranked, error: rankError } = await supabase.rpc("get_ranked_feed", {
        p_viewer_id: user.id,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (rankError) throw rankError;

      // supabase.rpc() isn't given a type param, so `ranked` (and thus
      // anything derived from it with .map/.filter) comes back as `any`
      // unless pinned down explicitly — hence the annotation here.
      const orderedIds: string[] = (ranked ?? []).map((r: { post_id: string }) => r.post_id);
      if (orderedIds.length === 0) return [];

      const { data, error } = await supabase
        .from("posts")
        .select(FEED_SELECT)
        .in("id", orderedIds);
      if (error) throw error;

      const byId = new Map((data as any[]).map((raw) => [raw.id, normalizePost(raw)]));
      const posts = orderedIds.map((id) => byId.get(id)).filter((p): p is PostWithAuthor => !!p);

      // Fire-and-forget — a failed token fulfillment shouldn't block
      // the feed from rendering, just means a token stays unconsumed
      // until the next page load that includes the same prioritized post.
      supabase.rpc("fulfill_gift_tokens", {
        p_viewer_id: user.id,
        p_served_post_ids: orderedIds,
      }).then(({ error: fulfillError }) => {
        if (fulfillError) console.error("fulfill_gift_tokens failed:", fulfillError);
      });

      return posts;
    },
    enabled: enabled && !!user,
  });
}

/**
 * Explicit topic browsing (tapping a topic pill in Discover) stays
 * plain reverse-chronological within that topic — a deliberate "show
 * me everything tagged X" mode, distinct from the personalized ranked
 * feed used when no topic filter is active.
 */
function useTopicFeed(interestId: string, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ["feed-posts", "topic", interestId, page],
    queryFn: async (): Promise<PostWithAuthor[]> => {
      const { data: postIds } = await supabase
        .from("post_topics")
        .select("post_id")
        .eq("interest_id", interestId);

      const ids = (postIds ?? []).map((p) => p.post_id);
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from("posts")
        .select(FEED_SELECT)
        .eq("is_deleted", false)
        .eq("is_archived", false)
        .in("id", ids)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (error) throw error;
      return (data as any[]).map(normalizePost);
    },
    enabled,
  });
}

export function useFeedPosts(interestId?: string, page = 0) {
  const ranked = useRankedFeed(page, !interestId);
  const topic = useTopicFeed(interestId ?? "", page, !!interestId);
  return interestId ? topic : ranked;
}

export function useFollowingFeed(page = 0) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["feed-posts", "following", user?.id, page],
    queryFn: async (): Promise<PostWithAuthor[]> => {
      if (!user) return [];

      const { data: ranked, error: rankError } = await supabase.rpc("get_following_feed", {
        p_viewer_id: user.id,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (rankError) throw rankError;

      const orderedIds: string[] = (ranked ?? []).map((r: { post_id: string }) => r.post_id);
      if (orderedIds.length === 0) return [];

      const { data, error } = await supabase
        .from("posts")
        .select(FEED_SELECT)
        .in("id", orderedIds);
      if (error) throw error;

      const byId = new Map((data as any[]).map((raw) => [raw.id, normalizePost(raw)]));

      supabase.rpc("fulfill_gift_tokens", {
        p_viewer_id: user.id,
        p_served_post_ids: orderedIds,
      }).then(({ error: fulfillError }) => {
        if (fulfillError) console.error("fulfill_gift_tokens failed:", fulfillError);
      });

      return orderedIds.map((id) => byId.get(id)).filter((p): p is PostWithAuthor => !!p);
    },
    enabled: !!user,
  });
}

export function useTopDiscussionsFeed(page = 0) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["feed-posts", "top", user?.id, page],
    queryFn: async (): Promise<PostWithAuthor[]> => {
      if (!user) return [];

      const { data: ranked, error: rankError } = await supabase.rpc("get_trending_feed", {
        p_viewer_id: user.id,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (rankError) throw rankError;

      const orderedIds: string[] = (ranked ?? []).map((r: { post_id: string }) => r.post_id);
      if (orderedIds.length === 0) return [];

      const { data, error } = await supabase
        .from("posts")
        .select(FEED_SELECT)
        .in("id", orderedIds);
      if (error) throw error;

      const byId = new Map((data as any[]).map((raw) => [raw.id, normalizePost(raw)]));
      return orderedIds.map((id) => byId.get(id)).filter((p): p is PostWithAuthor => !!p);
    },
    enabled: !!user,
  });
}

/**
 * A single post by id, in the same fully-joined shape as the feed
 * queries (author, posted_as_page, tagged_project, reshared_post) —
 * a distinct query key from PostDetail.tsx's own local `usePost`
 * (["post", id]), which only joins `author`. Sharing that key would
 * mean whichever query happened to populate the cache first "wins"
 * the shape for both call sites, even though the two select different
 * columns — not worth the entanglement for what's otherwise an
 * unrelated read. Currently used by Feed.tsx to pin a just-published
 * post at the top of the "For You" list the instant it lands there
 * (see justPostedId) — the ranked feed itself has no reason to
 * surface a brand-new, zero-engagement post anywhere near the top
 * (see get_ranked_feed: a fresh post scores 0 until it has
 * engagement), so that placement is done here client-side rather than
 * by waiting on the ranking algorithm to do it.
 */
export function usePostById(postId: string | null) {
  return useQuery({
    queryKey: ["post-full", postId],
    queryFn: async (): Promise<PostWithAuthor> => {
      const { data, error } = await supabase
        .from("posts")
        .select(FEED_SELECT)
        .eq("id", postId)
        .single();
      if (error) throw error;
      return normalizePost(data);
    },
    enabled: !!postId,
  });
}

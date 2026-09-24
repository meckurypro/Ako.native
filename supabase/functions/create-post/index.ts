// supabase/functions/create-post/index.ts
//
// AKỌ — Edge Function: create-post. The ONLY way a post gets created (direct client inserts into
// `posts` are blocked by RLS); it always moderates first. Version-controlled here so the mobile
// outbox contract is reviewable next to the app; the web repo carries the same function.
//
// Gates: probational partial access (fn_can_access_feature('probational_post_enabled')), fail-closed.
// Also handles: draft/scheduled status, heading_color, optional catalogue music, tagged_project_id
// (verified: caller's own, active, non-private project).
//
// NEW — client_request_id (idempotency). Optional UUID chosen by the client and resent on every retry
// of the same logical post. A repeat of (author, client_request_id) returns the post that already
// exists (HTTP 200, `deduplicated: true`) and does nothing else: no second moderation call, no second
// insert, no second set of hashtags/topics/usage events. Backed by the partial unique index
// posts_author_client_request_id_key, which also settles two concurrent identical requests: the loser
// gets 23505 and returns the winner's row. Requests without the field behave exactly as before.
// Requires migration 20260924100000_posts_client_request_id.sql to be applied first.
//
// Deploy: supabase functions deploy create-post
// Secrets required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const HEADING_LIMIT = 50;
const CONTENT_LIMIT = 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Keep in sync with src/lib/headingColors.ts and the posts_heading_color_check DB constraint.
const HEADING_COLORS = [
  "sapphire", "emerald", "amber", "garnet", "amethyst", "petrol", "espresso", "graphite",
] as const;
type HeadingColor = (typeof HEADING_COLORS)[number];

type PostStatus = "draft" | "scheduled" | "published";

interface CreatePostRequest {
  heading?: string;
  content?: string;
  category_id?: string;
  media_urls?: string[];
  interest_ids?: string[];
  visibility?: "public" | "followers_only";
  status?: PostStatus;
  scheduled_for?: string;
  music_catalogue_id?: string | null;
  heading_color?: HeadingColor | null;
  tagged_project_id?: string | null;
  // Idempotency key — see header.
  client_request_id?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: "Invalid or expired session" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Probational partial-access gate — fail CLOSED: if the check itself errors, don't let the post through.
  const { data: canAccess, error: gateError } = await admin.rpc("fn_can_access_feature", {
    p_feature_key: "probational_post_enabled",
    p_user_id: user.id,
  });
  if (gateError) {
    console.error("create-post gate check error:", gateError);
    return jsonResponse({ error: "Couldn't verify account access. Please try again." }, 503);
  }
  if (!canAccess) {
    return jsonResponse({ error: "Posting isn't available on your account yet.", decision: "pending_review" }, 403);
  }

  try {
    const body: CreatePostRequest = await req.json();
    const { category_id, media_urls, interest_ids, visibility } = body;
    const heading = body.heading?.trim() ?? "";
    const content = body.content?.trim() ?? "";
    const status: PostStatus = body.status ?? "published";
    const musicCatalogueId = body.music_catalogue_id ?? null;
    const headingColor = body.heading_color ?? null;
    const taggedProjectId = body.tagged_project_id ?? null;
    const clientRequestId = body.client_request_id ?? null;

    if (clientRequestId !== null && (typeof clientRequestId !== "string" || !UUID_RE.test(clientRequestId))) {
      return jsonResponse({ error: "Invalid client_request_id" }, 400);
    }

    if (!heading && !content) {
      return jsonResponse({ error: "Add a heading or some details before posting" }, 400);
    }
    if (heading.length > HEADING_LIMIT) {
      return jsonResponse({ error: `Heading exceeds ${HEADING_LIMIT} character limit` }, 400);
    }
    if (content.length > CONTENT_LIMIT) {
      return jsonResponse({ error: `Content exceeds ${CONTENT_LIMIT} character limit` }, 400);
    }
    if (headingColor !== null && !HEADING_COLORS.includes(headingColor)) {
      return jsonResponse({ error: "Invalid heading_color" }, 400);
    }

    if (status !== "draft" && status !== "scheduled" && status !== "published") {
      return jsonResponse({ error: "Invalid status" }, 400);
    }
    let scheduledForDate: Date | null = null;
    if (status === "scheduled") {
      if (!body.scheduled_for) {
        return jsonResponse({ error: "scheduled_for is required when status is 'scheduled'" }, 400);
      }
      scheduledForDate = new Date(body.scheduled_for);
      if (Number.isNaN(scheduledForDate.getTime())) {
        return jsonResponse({ error: "scheduled_for is not a valid date" }, 400);
      }
      if (scheduledForDate.getTime() <= Date.now()) {
        return jsonResponse({ error: "scheduled_for must be in the future" }, 400);
      }
    } else if (body.scheduled_for) {
      return jsonResponse({ error: "scheduled_for should only be set when status is 'scheduled'" }, 400);
    }

    // Repeat of a request that already created its post: hand that post back and stop. Checked after
    // the cheap validation above but before moderation and any write, so a retry has no side effects.
    if (clientRequestId) {
      const existing = await findExistingPost(admin, user.id, clientRequestId);
      if (existing) return jsonResponse({ success: true, post: existing, deduplicated: true }, 200);
    }

    if (musicCatalogueId) {
      const { data: catalogueEntry } = await admin
        .from("music_catalogue")
        .select("id, publication_status")
        .eq("id", musicCatalogueId)
        .maybeSingle();
      if (!catalogueEntry || catalogueEntry.publication_status !== "published") {
        return jsonResponse({ error: "That song isn't available to attach right now" }, 400);
      }
    }

    // Tagged project — mirrors TagProjectPicker.tsx's own scope (the caller's own project,
    // published/active, not private) so the server-side check can never diverge from what the
    // picker offered. A stale pill is rejected rather than silently posted without its tag.
    if (taggedProjectId) {
      const { data: taggedProject } = await admin
        .from("projects")
        .select("id, owner_id, status, is_private")
        .eq("id", taggedProjectId)
        .maybeSingle();
      if (
        !taggedProject ||
        taggedProject.owner_id !== user.id ||
        taggedProject.status !== "active" ||
        taggedProject.is_private
      ) {
        return jsonResponse({ error: "That project can't be tagged right now." }, 400);
      }
    }

    const combinedText = [heading, content].filter(Boolean).join("\n\n");

    const modResponse = await fetch(`${SUPABASE_URL}/functions/v1/moderate-content`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: user.id,
        content_type: "post",
        content: combinedText,
      }),
    });

    const modResult = await modResponse.json();

    if (modResult.decision !== "allowed") {
      return jsonResponse({
        error: modResult.message ?? "This content can't be posted.",
        decision: modResult.decision,
      }, 422);
    }

    const { data: post, error: insertError } = await admin
      .from("posts")
      .insert({
        author_id: user.id,
        heading: heading || null,
        heading_color: heading ? headingColor : null,
        content,
        category_id: category_id ?? null,
        media_urls: media_urls ?? [],
        visibility: visibility ?? "public",
        status,
        scheduled_for: scheduledForDate ? scheduledForDate.toISOString() : null,
        music_catalogue_id: musicCatalogueId,
        tagged_project_id: taggedProjectId,
        client_request_id: clientRequestId,
      })
      .select()
      .single();

    if (insertError) {
      // Lost a race with an identical concurrent request: the unique index rejected us, so the other
      // request's post is the answer.
      if (clientRequestId && insertError.code === "23505") {
        const existing = await findExistingPost(admin, user.id, clientRequestId);
        if (existing) return jsonResponse({ success: true, post: existing, deduplicated: true }, 200);
      }
      throw insertError;
    }

    if (interest_ids?.length) {
      const validInterests = await admin
        .from("interests")
        .select("id")
        .in("id", interest_ids)
        .eq("is_active", true);

      const topicRows = (validInterests.data ?? []).map((i: { id: string }) => ({
        post_id: post.id,
        interest_id: i.id,
      }));

      if (topicRows.length) {
        await admin.from("post_topics").insert(topicRows);
      }
    }

    const hashtags = extractHashtags(combinedText);
    for (const tag of hashtags) {
      const { data: existing } = await admin
        .from("hashtags")
        .select("id, usage_count")
        .eq("tag", tag)
        .maybeSingle();

      let hashtagId: string;

      if (existing) {
        await admin
          .from("hashtags")
          .update({ usage_count: existing.usage_count + 1 })
          .eq("id", existing.id);
        hashtagId = existing.id;
      } else {
        const { data: created } = await admin
          .from("hashtags")
          .insert({ tag, usage_count: 1 })
          .select("id")
          .single();
        hashtagId = created!.id;
      }

      await admin.from("post_hashtags").insert({ post_id: post.id, hashtag_id: hashtagId });
    }

    if (musicCatalogueId) {
      await admin.from("music_catalogue_usage_events").insert({
        catalogue_id: musicCatalogueId,
        event_type: "post_attach",
        post_id: post.id,
        actor_id: user.id,
      });
    }

    return jsonResponse({ success: true, post }, 201);

  } catch (err) {
    console.error("create-post error:", err);
    return jsonResponse({ error: "Failed to create post" }, 500);
  }
});

async function findExistingPost(
  admin: ReturnType<typeof createClient>,
  authorId: string,
  clientRequestId: string,
) {
  const { data } = await admin
    .from("posts")
    .select()
    .eq("author_id", authorId)
    .eq("client_request_id", clientRequestId)
    .maybeSingle();
  return data ?? null;
}

function extractHashtags(content: string): string[] {
  const matches = content.match(/#[a-zA-Z0-9_]+/g) ?? [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

function jsonResponse(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// supabase/functions/create-page-post/index.ts
//
// AKỌ — Edge Function: create-page-post. The Page-mode counterpart to create-post: same shape plus
// a required page_id. Posts are attributed to the page via posts.posted_as_page_id (author_id stays
// the real human). Flow: verify the caller's JWT -> verify they are an ACTIVE ADMIN of the page ->
// moderate -> insert via service role. Supports draft/scheduled status and heading_color like create-post.
//
// NEW — client_request_id: same idempotency contract as create-post (see that file's header). A repeat
// of (author, client_request_id) returns the existing post with HTTP 200 and `deduplicated: true`.
// The lookup runs after the page-admin check, so a request is never answered for a page the caller
// can't post as. Requires migration 20260924100000_posts_client_request_id.sql first.
//
// Deploy: supabase functions deploy create-page-post
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

const MAX_CONTENT_LENGTH = 1000; // matches posts.content's CHECK constraint
const MAX_HEADING_LENGTH = 50; // matches posts.heading's CHECK constraint
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Keep in sync with src/lib/headingColors.ts and the posts_heading_color_check DB constraint.
const HEADING_COLORS = [
  "sapphire", "emerald", "amber", "garnet", "amethyst", "petrol", "espresso", "graphite",
] as const;
type HeadingColor = (typeof HEADING_COLORS)[number];

type PostStatus = "draft" | "scheduled" | "published";

interface CreatePagePostRequest {
  page_id: string;
  heading?: string;
  content: string;
  category_id?: string;
  interest_ids?: string[];
  media_urls?: string[];
  status?: PostStatus;
  scheduled_for?: string; // ISO timestamp — required iff status === "scheduled"
  heading_color?: HeadingColor | null;
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

  try {
    const body: CreatePagePostRequest = await req.json();
    const { page_id, heading, content, category_id, interest_ids, media_urls } = body;
    const status: PostStatus = body.status ?? "published";
    const headingColor = body.heading_color ?? null;
    const clientRequestId = body.client_request_id ?? null;

    if (clientRequestId !== null && (typeof clientRequestId !== "string" || !UUID_RE.test(clientRequestId))) {
      return jsonResponse({ error: "Invalid client_request_id" }, 400);
    }
    if (!page_id) {
      return jsonResponse({ error: "page_id is required" }, 400);
    }
    if (!content?.trim()) {
      return jsonResponse({ error: "Content cannot be empty" }, 400);
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return jsonResponse({ error: `Content exceeds ${MAX_CONTENT_LENGTH} character limit` }, 400);
    }
    if (heading && heading.length > MAX_HEADING_LENGTH) {
      return jsonResponse({ error: `Heading exceeds ${MAX_HEADING_LENGTH} character limit` }, 400);
    }
    if (headingColor !== null && !HEADING_COLORS.includes(headingColor)) {
      return jsonResponse({ error: "Invalid heading_color" }, 400);
    }

    // status/scheduled_for validation — mirrors the DB-level posts_scheduled_for_matches_status CHECK.
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

    // Confirm the page exists/is active, and that the caller is an ACTIVE ADMIN of it.
    const { data: page, error: pageError } = await admin
      .from("pages")
      .select("id, is_active")
      .eq("id", page_id)
      .maybeSingle();

    if (pageError || !page || !page.is_active) {
      return jsonResponse({ error: "Page not found" }, 404);
    }

    const { data: membership } = await admin
      .from("page_members")
      .select("is_admin, status")
      .eq("page_id", page_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership || membership.status !== "active" || !membership.is_admin) {
      return jsonResponse({ error: "Only a page admin can post as this page" }, 403);
    }

    // Repeat of a request that already created its post: hand it back, no moderation, no second write.
    if (clientRequestId) {
      const existing = await findExistingPost(admin, user.id, clientRequestId);
      if (existing) return jsonResponse({ success: true, post: existing, deduplicated: true }, 200);
    }

    // Moderate BEFORE anything is written (runs regardless of status: a draft is checked now).
    const modResponse = await fetch(`${SUPABASE_URL}/functions/v1/moderate-content`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: user.id,
        content_type: "post",
        content,
      }),
    });

    const modResult = await modResponse.json();

    if (modResult.decision !== "allowed") {
      return jsonResponse({
        error: modResult.message ?? "This content can't be posted.",
        decision: modResult.decision,
      }, 422);
    }

    // Insert attributed to the page (service role bypasses RLS by design — posts.posted_as_page_id
    // has no client-writable path, this function is the only way it ever gets set).
    const { data: post, error: insertError } = await admin
      .from("posts")
      .insert({
        author_id: user.id,
        posted_as_page_id: page_id,
        heading: heading ?? null,
        heading_color: heading ? headingColor : null,
        content,
        category_id: category_id ?? null,
        media_urls: media_urls ?? [],
        status,
        scheduled_for: scheduledForDate ? scheduledForDate.toISOString() : null,
        client_request_id: clientRequestId,
      })
      .select()
      .single();

    if (insertError) {
      // Lost a race with an identical concurrent request: return the winner's row.
      if (clientRequestId && insertError.code === "23505") {
        const existing = await findExistingPost(admin, user.id, clientRequestId);
        if (existing) return jsonResponse({ success: true, post: existing, deduplicated: true }, 200);
      }
      throw insertError;
    }

    if (interest_ids && interest_ids.length > 0) {
      const { error: topicsError } = await admin
        .from("post_topics")
        .insert(interest_ids.map((interest_id) => ({ post_id: post.id, interest_id })));
      if (topicsError) console.error("create-page-post: failed to attach interests:", topicsError);
    }

    return jsonResponse({ success: true, post }, 201);

  } catch (err) {
    console.error("create-page-post error:", err);
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

function jsonResponse(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

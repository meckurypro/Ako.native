// File: supabase/functions/send-message-push/index.ts
// Item 8 — server half. Invoked (fire-and-forget) from the native app right
// after a message insert succeeds: features/messaging/api.ts's notifyPush()
// and lib/outbox.ts's reconcileLocalMessage() both call this with
// { message_id }. Not a DB trigger — see the deploy notes at the bottom of
// this file for why, and how to upgrade to one later if it matters.
//
// Deliberately does not put message content in the push title/body. A
// recent migration (stop_storing_plaintext_message_preview) stopped
// writing message content into `notifications.preview_text` for the exact
// same reason: DM content shouldn't end up sitting in a push payload or an
// OS notification tray. This mirrors that call, not just for privacy today
// but because the app already has E2EE identity/prekey tables staged
// (e2ee_device_identity_and_prekeys) — a push body built from plaintext
// content would need rework anyway once encryption lands.
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100; // Expo's documented max per request

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ExpoTicket = { status: "ok" | "error"; message?: string; details?: { error?: string } };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message_id } = await req.json();
    if (!message_id || typeof message_id !== "string") {
      return new Response(JSON.stringify({ error: "message_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: message, error: messageError } = await admin
      .from("messages")
      .select("id, conversation_id, sender_id, content")
      .eq("id", message_id)
      .single();
    if (messageError || !message) {
      return new Response(JSON.stringify({ error: "Message not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // The caller must be the message's own sender — this endpoint only ever
    // notifies *about* a message the caller just sent, never lets a client
    // trigger a push for a message it doesn't own.
    if (message.sender_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [{ data: sender }, { data: participants, error: participantsError }] = await Promise.all([
      admin.from("profiles").select("display_name, username").eq("id", message.sender_id).single(),
      admin
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", message.conversation_id)
        .neq("user_id", message.sender_id)
        .is("left_at", null),
    ]);
    if (participantsError) throw participantsError;

    const recipientIds = (participants ?? []).map((p) => p.user_id);
    if (!recipientIds.length) return new Response(JSON.stringify({ sent: 0, reason: "no recipients" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const [{ data: blocks }, { data: mutes }, { data: tokenRows }] = await Promise.all([
      admin.from("blocked_users").select("blocker_id").eq("blocked_id", message.sender_id).in("blocker_id", recipientIds),
      admin.from("muted_users").select("muter_id").eq("muted_id", message.sender_id).in("muter_id", recipientIds),
      admin.from("push_tokens").select("id, token, user_id").in("user_id", recipientIds),
    ]);

    const suppressed = new Set([...(blocks ?? []).map((b) => b.blocker_id), ...(mutes ?? []).map((m) => m.muter_id)]);
    const targets = (tokenRows ?? []).filter((row) => !suppressed.has(row.user_id));
    if (!targets.length) return new Response(JSON.stringify({ sent: 0, reason: "no eligible tokens" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const senderName = sender?.display_name || sender?.username || "Someone";
    const isVoiceNote = message.content.startsWith("ako-voice-note:v1:");
    const body = isVoiceNote ? "Sent a voice note" : "Sent you a message";

    const notifications = targets.map((t) => ({
      to: t.token,
      title: senderName,
      body,
      sound: "default",
      data: { type: "message", conversationId: message.conversation_id, messageId: message.id },
    }));

    const tickets: ExpoTicket[] = [];
    for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
      const batch = notifications.slice(i, i + BATCH_SIZE);
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      const json = await response.json();
      if (Array.isArray(json?.data)) tickets.push(...(json.data as ExpoTicket[]));
    }

    // Prune tokens Expo says are dead — otherwise every future send keeps
    // re-trying (and re-failing) the same stale token forever.
    const deadTokenIds: string[] = [];
    tickets.forEach((ticket, index) => {
      if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") deadTokenIds.push(targets[index]?.id);
    });
    if (deadTokenIds.length) await admin.from("push_tokens").delete().in("id", deadTokenIds.filter(Boolean));

    return new Response(JSON.stringify({ sent: targets.length, pruned: deadTokenIds.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("send-message-push error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// Deploy notes (not executed — for whoever reads this next):
//
// This is called by the client right after a successful send, not by a
// Postgres trigger. A true DB-level trigger (pg_net.http_post on an
// AFTER INSERT trigger) would be more robust — it'd fire even if the app
// crashes or is killed right after the insert — but it needs either the
// service role key or a shared secret available inside Postgres to
// authenticate the trigger's call to this function, and neither was
// available to generate this migration safely. If that's worth closing:
// enable the pg_net extension, store a secret in Vault, set this
// function's verify_jwt to false, compare that secret against an
// `x-webhook-secret` header inside the function instead of doing
// userClient.auth.getUser(), and add the AFTER INSERT trigger on
// `messages`. Until then, this covers the common case (app stays open
// long enough to finish the insert + this call) and is honestly the
// same reliability tier as most of this app's other client-invoked
// side effects.

// File: features/messaging/useFailedOutboxMessages.ts
// Messages and voice notes in one conversation that the outbox gave up on (dead-lettered): the
// server refused them, or they ran out of retries. Their local bubbles can't be long-pressed and
// aren't restored after a restart, so without this they'd be stuck with no way to retry or discard.
// SQLite has no live queries, so this re-reads whenever lib/outbox.ts announces a change.
import { useEffect, useState } from "react";
import { listOutboxItems, subscribeOutbox } from "@/lib/outbox";
import { useAuth } from "@/providers/AuthProvider";

export type FailedOutboxMessage = { localId: string; kind: "text" | "voice"; preview: string };

const NONE: FailedOutboxMessage[] = [];

export function useFailedOutboxMessages(conversationId: string | undefined): FailedOutboxMessage[] {
  const { user } = useAuth();
  const userId = user?.id;
  const [items, setItems] = useState<FailedOutboxMessage[]>(NONE);

  useEffect(() => {
    if (!userId || !conversationId) return;
    let alive = true;
    const load = () => {
      void listOutboxItems().then((list) => {
        if (!alive) return;
        setItems(
          list
            .filter((item) => item.conversationId === conversationId && item.status === "failed" && (item.kind === "text" || item.kind === "voice"))
            .map((item) => ({
              localId: item.localId,
              kind: item.kind as "text" | "voice",
              preview: item.kind === "voice" ? "Voice message" : String((item.payload as { content?: unknown } | null)?.content ?? "Message"),
            }))
        );
      });
    };
    load();
    const unsubscribe = subscribeOutbox(load);
    return () => { alive = false; unsubscribe(); };
  }, [userId, conversationId]);

  return userId && conversationId ? items : NONE;
}

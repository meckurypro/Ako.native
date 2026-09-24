// File: features/feed/useOutboxPosts.ts
// Posts the current user composed while offline (or that are still sending / gave up), read from the
// outbox so they can be shown as placeholder cards at the top of the feed and the user's own profile.
// SQLite has no live queries, so this re-reads whenever lib/outbox.ts announces a change.
import { useEffect, useState } from "react";
import { listOutboxItems, subscribeOutbox, type OutboxPostPayload, type OutboxStatus } from "@/lib/outbox";
import { useAuth } from "@/providers/AuthProvider";

export type PendingPost = { localId: string; payload: OutboxPostPayload; status: OutboxStatus; attempts: number; lastError: string | null; createdAt: string };

const NONE: PendingPost[] = [];

export function useOutboxPosts(): PendingPost[] {
  const { user } = useAuth();
  const userId = user?.id;
  const [items, setItems] = useState<PendingPost[]>(NONE);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const load = () => {
      void listOutboxItems("post").then((list) => {
        if (!alive) return;
        setItems(
          list
            .map((item) => ({ localId: item.localId, payload: item.payload as OutboxPostPayload | null, status: item.status, attempts: item.attempts, lastError: item.lastError, createdAt: item.createdAt }))
            // Drafts and scheduled posts aren't in the feed even once sent, so they get no placeholder.
            .filter((item): item is PendingPost => !!item.payload && item.payload.status !== "draft" && item.payload.status !== "scheduled")
        );
      });
    };
    load();
    const unsubscribe = subscribeOutbox(load);
    return () => { alive = false; unsubscribe(); };
  }, [userId]);

  return userId ? items : NONE;
}

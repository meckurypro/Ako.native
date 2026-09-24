// File: lib/screenState.ts
// Once React Query knows the device is offline (see lib/query-client.ts), a query that has
// never loaded doesn't fail: it *pauses* (fetchStatus "paused"), which leaves isLoading,
// isError and data all falsy/undefined. Screens that only branch on isLoading/isError then
// fall through to their "empty" or "not found" states ("No gigs yet", "Profile unavailable")
// while the real situation is "we haven't been able to load this yet". This is the one
// place that says which of the four situations a screen is in.
import type { FetchStatus } from "@tanstack/react-query";

export type ScreenState = "loading" | "offline" | "error" | "ready";

type QueryLike = { data: unknown; fetchStatus: FetchStatus; isLoading: boolean; isError: boolean };

export function getScreenState(query: QueryLike): ScreenState {
  // Anything already on screen (fresh, cached in memory, or restored from disk) wins:
  // an offline or failed background refetch shouldn't replace content with a state screen.
  if (query.data !== undefined) return "ready";
  if (query.fetchStatus === "paused") return "offline";
  if (query.isLoading) return "loading";
  if (query.isError) return "error";
  return "ready";
}

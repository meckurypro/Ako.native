import { AppState, type AppStateStatus } from "react-native";
import { focusManager, QueryClient } from "@tanstack/react-query";

AppState.addEventListener("change", (state: AppStateStatus) => focusManager.setFocused(state === "active"));

// gcTime must be >= the persister's maxAge (see AppProviders) or restored cache entries
// get garbage-collected the moment they're hydrated back in.
export const QUERY_CACHE_MAX_AGE = 24 * 60 * 60_000; // 24h

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: QUERY_CACHE_MAX_AGE, retry: 1, refetchOnReconnect: true },
    mutations: { retry: 0 },
  },
});

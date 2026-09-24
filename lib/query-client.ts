import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import { isOfflineStatus } from "./network";

AppState.addEventListener("change", (state: AppStateStatus) => focusManager.setFocused(state === "active"));

// React Query only knows the device is offline if it's told. Without this it always assumes
// "online": queries never pause, refetchOnReconnect never fires, and offline screens fail
// (or hang on a dead connection) instead of holding their cached data. Reachability of
// "unknown" counts as online, same as lib/network.ts, so a platform that can't report it
// doesn't freeze every query.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!isOfflineStatus({ isConnected: state.isConnected ?? true, isInternetReachable: state.isInternetReachable })))
);

// gcTime must be >= the persister's maxAge (see AppProviders) or restored cache entries
// get garbage-collected the moment they're hydrated back in.
export const QUERY_CACHE_MAX_AGE = 24 * 60 * 60_000; // 24h

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: QUERY_CACHE_MAX_AGE, retry: 1, refetchOnReconnect: true },
    // Mutations must run even when we think we're offline: useSendMessage, useSendVoiceNote and
    // the composer check isCurrentlyOffline() themselves and queue into the outbox. With the
    // default ("online") they'd sit paused and that branch would never execute.
    mutations: { retry: 0, networkMode: "always" },
  },
});

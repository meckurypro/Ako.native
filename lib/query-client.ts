import { AppState, type AppStateStatus } from "react-native";
import { focusManager, QueryClient } from "@tanstack/react-query";

AppState.addEventListener("change", (state: AppStateStatus) => focusManager.setFocused(state === "active"));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnReconnect: true },
    mutations: { retry: 0 },
  },
});

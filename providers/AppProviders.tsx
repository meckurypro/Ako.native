import type { PropsWithChildren } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { queryClient, QUERY_CACHE_MAX_AGE } from "@/lib/query-client";
import { createSQLitePersister } from "@/lib/query-persister";
import { AuthProvider } from "./AuthProvider";
import { ThemeProvider } from "./ThemeProvider";

// Bump this when a persisted query shape changes incompatibly (e.g. a field renamed
// in a query's return type) to invalidate old cached rows instead of crashing on them.
const PERSIST_BUSTER = "v1";
const persister = createSQLitePersister();

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: QUERY_CACHE_MAX_AGE, buster: PERSIST_BUSTER }}
        >
          <ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

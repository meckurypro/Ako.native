import { useEffect } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { queryClient, QUERY_CACHE_MAX_AGE } from "@/lib/query-client";
import { createSQLitePersister } from "@/lib/query-persister";
import { NetworkProvider, onNetworkReconnect } from "@/lib/network";
import { flushOutbox } from "@/lib/outbox";
import { AuthProvider } from "./AuthProvider";
import { ThemeProvider } from "./ThemeProvider";
import type { PropsWithChildren } from "react";

// Bump this when a persisted query shape changes incompatibly (e.g. a field renamed
// in a query's return type) to invalidate old cached rows instead of crashing on them.
const PERSIST_BUSTER = "v1";
const persister = createSQLitePersister();

// Drains the offline outbox on every reconnect, plus once at startup in case
// messages were queued in a previous session that never came back online.
function OutboxSync() {
  useEffect(() => {
    void flushOutbox();
    return onNetworkReconnect(() => void flushOutbox());
  }, []);
  return null;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: QUERY_CACHE_MAX_AGE, buster: PERSIST_BUSTER }}
        >
          <NetworkProvider>
            <ThemeProvider>
              <AuthProvider>
                <OutboxSync />
                {children}
              </AuthProvider>
            </ThemeProvider>
          </NetworkProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

import { useEffect } from "react";
import { AppState } from "react-native";
import type { Query } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { queryClient, QUERY_CACHE_MAX_AGE } from "@/lib/query-client";
import { createSQLitePersister } from "@/lib/query-persister";
import { NetworkProvider, onNetworkReconnect } from "@/lib/network";
import { flushOutbox } from "@/lib/outbox";
import { pruneStaleProfiles } from "@/lib/local-cache";
import { sweepAudioCache } from "@/lib/audio-cache";
import { configureVideoCache } from "@/lib/media-cache";
import { primeVoicePlaybackPositions } from "@/features/messaging/voicePlaybackPosition";
import { usePushRegistration } from "@/features/notifications/push";
import { AuthProvider, useAuth } from "./AuthProvider";
import { ThemeProvider } from "./ThemeProvider";
import type { PropsWithChildren } from "react";

// Warm the voice-note playback-position cache early so the first voice
// bubble to render can resume synchronously (see the module for why).
primeVoicePlaybackPositions();

// Cached profile rows older than a week are dead weight (and stale avatars); drop them once per launch.
void pruneStaleProfiles();

// Remove voice-note audio files the cache index doesn't know about (interrupted wipe or download).
void sweepAudioCache();

// Cap expo-video's disk cache (used for post videos). Must run before any video player exists.
configureVideoCache();

// Bump this when a persisted query shape changes incompatibly (e.g. a field renamed
// in a query's return type) to invalidate old cached rows instead of crashing on them.
const PERSIST_BUSTER = "v1";
const persister = createSQLitePersister();

// Only these query roots are written to disk. The persisted cache is plaintext SQLite, so it holds
// what makes cold starts and offline browsing feel instant (feed, conversation list, profiles) and
// nothing financial or activity-level. Messages live in messages_cache instead, so the
// "mobile-messages" query is deliberately absent, as are wallet and notification queries.
const PERSISTED_QUERY_ROOTS = new Set(["feed", "identity-posts", "post", "mobile-conversations", "profile", "own-profile", "my-profile"]);
const dehydrateOptions = {
  shouldDehydrateQuery: (query: Query) => query.state.status === "success" && PERSISTED_QUERY_ROOTS.has(String(query.queryKey[0])),
};

// How often to retry while the app is open, so a row that is backing off (or a flush that raced a
// flaky connection) doesn't sit until the next reconnect or foreground.
const OUTBOX_POLL_MS = 60_000;

// Drains the offline outbox. Triggers: a user becoming available (sign-in, cold start once the
// session restores — an unconditional flush at mount ran before the session existed and found
// nothing it could send), the app returning to the foreground, every network reconnect, and a
// slow timer while the app is in the foreground. Overlapping requests are coalesced in flushOutbox.
function OutboxSync() {
  const { user } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    void flushOutbox();
    const unsubscribeReconnect = onNetworkReconnect(() => void flushOutbox());
    const appStateSub = AppState.addEventListener("change", (state) => { if (state === "active") void flushOutbox(); });
    const timer = setInterval(() => { if (AppState.currentState === "active") void flushOutbox(); }, OUTBOX_POLL_MS);
    return () => { unsubscribeReconnect(); appStateSub.remove(); clearInterval(timer); };
  }, [userId]);
  return null;
}

// Registers the device's Expo push token whenever a user is signed in, and
// deep-links into a conversation when a message notification is tapped.
// See features/notifications/push.ts.
function PushSync() {
  usePushRegistration();
  return null;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: QUERY_CACHE_MAX_AGE, buster: PERSIST_BUSTER, dehydrateOptions }}
        >
          <NetworkProvider>
            <ThemeProvider>
              <AuthProvider>
                <OutboxSync />
                <PushSync />
                {children}
              </AuthProvider>
            </ThemeProvider>
          </NetworkProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

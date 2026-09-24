// File: components/core/OfflineBanner.tsx
// Top-of-screen connectivity strip. The wording depends on where you are: on a conversation it
// says what actually happens to what you type; everywhere else it's just "No connection"
// (it used to claim "showing saved messages" on every screen, including ones with nothing saved).
// On reconnect it briefly confirms, and says how many queued items are being sent.
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Text";
import { Icon } from "./Icon";
import { onNetworkReconnect, useNetworkStatus } from "@/lib/network";
import { getTotalPendingOutboxCount } from "@/lib/outbox";
import { useTheme } from "@/providers/ThemeProvider";

const BACK_ONLINE_MS = 3000;

export function OfflineBanner() {
  const { isOffline } = useNetworkStatus();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const inConversation = segments.includes("messages") && segments.some(segment => segment === "[conversationId]");
  const [backOnline, setBackOnline] = useState<{ sending: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = onNetworkReconnect(() => {
      void getTotalPendingOutboxCount().then(sending => {
        setBackOnline({ sending });
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setBackOnline(null), BACK_ONLINE_MS);
      });
    });
    return () => { unsubscribe(); if (timer.current) clearTimeout(timer.current); };
  }, []);

  if (!isOffline && !backOnline) return null;

  const online = !isOffline && !!backOnline;
  const label = online
    ? backOnline.sending > 0 ? `Back online — sending ${backOnline.sending} unsent ${backOnline.sending === 1 ? "item" : "items"}…` : "Back online"
    : inConversation ? "No connection — messages will send when you're back online" : "No connection";

  return (
    <View style={[styles.root, { top: insets.top, backgroundColor: online ? colors.accent : colors.textMuted }]} pointerEvents="none">
      <Icon name={online ? "check" : "wifi-off"} size={13} color={colors.background} />
      <Text style={[styles.label, { color: colors.background }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", left: 0, right: 0, zIndex: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6 },
  label: { fontSize: 12, fontWeight: "600" },
});

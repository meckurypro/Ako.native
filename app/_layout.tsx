// File: app/_layout.tsx
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../hooks/useAuth";
import { AutoHideProvider } from "../hooks/useAutoHideOnScroll";
import { ToastProvider } from "../components/Toast";
import { BottomNav } from "../components/BottomNav";

const queryClient = new QueryClient();

// The five top-level places switch with `replace` on web (no history
// stacking, no transition) — animation "none" keeps that feel here.
const NO_ANIM = { animation: "none" } as const;

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* ToastProvider wraps everything and renders its layer last so
            toasts sit above the Bottom Nav. */}
        <ToastProvider>
          <AutoHideProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="feed" options={NO_ANIM} />
              <Stack.Screen name="topics" options={NO_ANIM} />
              <Stack.Screen name="library" options={NO_ANIM} />
              <Stack.Screen name="inbox" options={NO_ANIM} />
              <Stack.Screen name="me" options={NO_ANIM} />
            </Stack>
            <BottomNav />
          </AutoHideProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

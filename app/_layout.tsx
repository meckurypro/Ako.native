// File: app/_layout.tsx
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../hooks/useAuth";
import { AutoHideProvider } from "../hooks/useAutoHideOnScroll";
import { ToastProvider } from "../components/Toast";
import { BottomNav } from "../components/BottomNav";
import { OnboardingGate } from "../components/OnboardingGate";
import { LoadingOverlay } from "../components/LoadingOverlay";
import { ErrorFallback } from "../components/ErrorFallback";

const queryClient = new QueryClient();

// expo-router route-level error boundary for the whole app — web's
// ErrorBoundary equivalent. Renders OUTSIDE the providers below.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorFallback error={error} retry={retry} />;
}

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
            <OnboardingGate />
            {/* Blocking-save spinner (mutations tagged meta.blocking). */}
            <LoadingOverlay />
          </AutoHideProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

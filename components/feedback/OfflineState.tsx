// File: components/feedback/OfflineState.tsx
// Shown instead of a spinner or an empty/"not found" state when a screen has nothing cached
// and the device is offline (see lib/screenState.ts).
import { EmptyState } from "./EmptyState";
import { refreshNetworkStatus } from "@/lib/network";

type Props = { message?: string; onRetry?: () => void };

export function OfflineState({ message = "This hasn't been saved on your device yet. It will load when you're back online.", onRetry }: Props) {
  // Re-check reachability before retrying: if the connection is back, React Query's online
  // manager flips and the paused fetch resumes; if it isn't, nothing is spun up for nothing.
  const retry = onRetry ? () => { void refreshNetworkStatus().finally(onRetry); } : undefined;
  return <EmptyState icon="wifi-off" title="You're offline" message={message} actionLabel={retry ? "Try again" : undefined} onAction={retry} />;
}

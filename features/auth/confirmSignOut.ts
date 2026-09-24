// File: features/auth/confirmSignOut.ts
// The outbox is per-user and survives sign-out (lib/outbox.ts), so signing out with unsent items
// doesn't lose them — but the person should know they're leaving something behind, and that it
// only sends once they're back in this account.
import { Alert } from "react-native";
import { getUnsentOutboxCount } from "@/lib/outbox";

export function unsentItemsLabel(count: number) {
  return `${count} unsent ${count === 1 ? "item" : "items"}`;
}

/** Resolves true if it's fine to sign out: nothing is queued, or the person confirmed. */
export async function confirmSignOutWithUnsent(): Promise<boolean> {
  const count = await getUnsentOutboxCount();
  if (count === 0) return true;
  return new Promise((resolve) => {
    Alert.alert(
      unsentItemsLabel(count),
      "They'll stay on this device and send once you're back online and signed in to this account.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Sign out anyway", style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

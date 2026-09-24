// File: providers/BiometricLockGate.tsx
import { type PropsWithChildren, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { BiometricLockScreen } from "@/components/security/BiometricLockScreen";
import { readBiometricLockEnabled, useBiometricCapability } from "@/features/security/biometric";
import { useAuth } from "./AuthProvider";

// A brief grace period after backgrounding, so switching to the OS app
// switcher, a share sheet, or a quick notification-shade peek doesn't
// force a fresh Face ID prompt every time — only an actual return from
// having been away relocks. Matches the general feel of WhatsApp/Instagram's
// own app-lock rather than relocking on every single frame in the background.
const GRACE_PERIOD_MS = 15_000;

export function BiometricLockGate({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const capability = useBiometricCapability();
  // Guards against a real lockout: if the setting is on but nothing is
  // actually enrolled on the device right now (uninstalled Face ID, wiped
  // fingerprints, a fresh device restore), authenticate() can never
  // succeed — never actually engage the lock in that state, matching the
  // "stays off until it is" caption on the settings toggle.
  const canLock = capability.supported && capability.enrolled;
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Cold start: lock immediately if the setting is on and there's a
    // session to protect — read directly from SecureStore rather than
    // useBiometricLockSetting's hook state, which wouldn't be loaded yet.
    if (!canLock) return;
    let alive = true;
    void readBiometricLockEnabled().then(enabled => { if (alive && enabled && session) setLocked(true); });
    return () => { alive = false; };
  }, [session, canLock]);

  useEffect(() => {
    if (!canLock) return;
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      const previous = appState.current;
      appState.current = next;
      if (next.match(/inactive|background/)) {
        backgroundedAt.current = Date.now();
        return;
      }
      if (next === "active" && previous.match(/inactive|background/)) {
        const awayMs = backgroundedAt.current ? Date.now() - backgroundedAt.current : Infinity;
        backgroundedAt.current = null;
        if (awayMs < GRACE_PERIOD_MS) return;
        void readBiometricLockEnabled().then(enabled => { if (enabled && session) setLocked(true); });
      }
    });
    return () => subscription.remove();
  }, [session, canLock]);

  // No session (signed out) means nothing sensitive to protect — never lock the auth screens.
  if (!locked || !session) return children;
  return <>{children}<BiometricLockScreen label={capability.label} onUnlock={() => setLocked(false)} /></>;
}

// File: providers/BiometricLockGate.tsx
import { type PropsWithChildren, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { BiometricLockScreen } from "@/components/security/BiometricLockScreen";
import { PrivacyCover } from "@/components/security/PrivacyCover";
import { getBiometricLockEnabledSync, readBiometricLockEnabled, useBiometricCapability } from "@/features/security/biometric";
import { useAuth } from "./AuthProvider";

// A brief grace period after backgrounding, so switching to the OS app
// switcher, a share sheet, or a quick notification-shade peek doesn't
// force a fresh Face ID prompt every time — only an actual return from
// having been away relocks. Matches the general feel of WhatsApp/Instagram's
// own app-lock rather than relocking on every single frame in the background.
const GRACE_PERIOD_MS = 15_000;

export function BiometricLockGate({ children }: PropsWithChildren) {
  const { session, isReady } = useAuth();
  const capability = useBiometricCapability();
  // Guards against a real lockout: if the setting is on but nothing is
  // actually enrolled on the device right now (uninstalled Face ID, wiped
  // fingerprints, a fresh device restore), authenticate() can never
  // succeed — never actually engage the lock in that state, matching the
  // "stays off until it is" caption on the settings toggle.
  const canLock = capability.supported && capability.enrolled;
  // Everything the lock decision depends on. Until all of it has loaded the answer is unknown, and
  // "unknown" must look locked, not unlocked — otherwise the first frames after a cold start show
  // the app (chats included) and the lock only appears once SecureStore and the device answer.
  const ready = isReady && !capability.loading;

  // null = not decided yet. Only true when the setting is on, a session exists and the device can lock.
  const [locked, setLocked] = useState<boolean | null>(null);
  // Whether app-lock is on and usable; gates the app-switcher cover. Refreshed on every foreground so a
  // toggle flipped in Settings is picked up.
  const [lockActive, setLockActive] = useState(false);
  // True while the app is inactive/backgrounded, i.e. while the OS may be snapshotting it.
  const [obscured, setObscured] = useState(AppState.currentState !== "active");
  const backgroundedAt = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Cold start: decide once, as soon as auth and the device capability are both known.
    if (!ready || locked !== null) return;
    let alive = true;
    void readBiometricLockEnabled().then(enabled => {
      if (!alive) return;
      setLockActive(enabled && canLock);
      setLocked(enabled && canLock && !!session);
    });
    return () => { alive = false; };
  }, [ready, locked, canLock, session]);

  // Signing out drops the lock: nothing to protect on the auth screens, and the next sign-in
  // (just authenticated with a password) shouldn't be greeted by a stale lock. Adjusted during
  // render (React's "derive state from props" pattern) rather than in an effect, so there is no
  // frame where a signed-out gate still says locked.
  const hasSession = !!session;
  const [hadSession, setHadSession] = useState(hasSession);
  if (hasSession !== hadSession) {
    setHadSession(hasSession);
    if (!hasSession && locked !== null) setLocked(false);
  }

  useEffect(() => {
    if (!ready) return;
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      const previous = appState.current;
      appState.current = next;
      if (next.match(/inactive|background/)) {
        // Keep the *first* moment we left the foreground: inactive -> background is one absence, not
        // two, and restarting the clock on the second transition would stretch the grace period.
        if (backgroundedAt.current === null) backgroundedAt.current = Date.now();
        setObscured(true);
        return;
      }
      if (next === "active") {
        setObscured(false);
        if (!previous.match(/inactive|background/)) return;
        const awayMs = backgroundedAt.current ? Date.now() - backgroundedAt.current : Infinity;
        backgroundedAt.current = null;
        void readBiometricLockEnabled().then(enabled => {
          setLockActive(enabled && canLock);
          if (enabled && canLock && session && awayMs >= GRACE_PERIOD_MS) setLocked(true);
        });
      }
    });
    return () => subscription.remove();
  }, [ready, session, canLock]);

  const showLock = locked === true && !!session;
  // Opaque cover: while the lock decision is still unknown, and (with app-lock on) whenever the app is
  // inactive/backgrounded so the app-switcher snapshot doesn't capture conversations. It also flashes
  // briefly behind the Face ID prompt and permission dialogs, which is expected. Android takes its
  // recents snapshot before `background` fires; blocking that needs FLAG_SECURE (expo-screen-capture).
  // The synchronous mirror wins over the state copy, which only refreshes on foreground: turning the
  // lock on (or off) in Settings applies to the very next time the app is backgrounded.
  const lockOn = (getBiometricLockEnabledSync() ?? lockActive) && canLock;
  const showCover = !ready || locked === null || (obscured && lockOn && !!session);

  return (
    <>
      {children}
      {showLock ? <BiometricLockScreen label={capability.label} onUnlock={() => setLocked(false)} /> : null}
      {showCover ? <PrivacyCover /> : null}
    </>
  );
}

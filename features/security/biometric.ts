// File: features/security/biometric.ts
import { useCallback, useEffect, useState } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

// Same convention as features/settings/api.ts's useSoundSettings: a
// device-local (not account-level) preference, persisted with SecureStore
// since it's a security setting rather than a cosmetic one.
const BIOMETRIC_LOCK_ENABLED_KEY = "ako-biometric-lock-enabled";

// In-memory mirror of the stored setting, kept current by both the settings toggle and the async
// read below. It lets the lock gate react in the same tick the setting changes (e.g. cover the app
// switcher snapshot the first time the app is backgrounded after turning the lock on) instead of
// waiting for the next foreground to re-read SecureStore. null = not loaded yet.
let lockEnabledMirror: boolean | null = null;
export function getBiometricLockEnabledSync(): boolean | null { return lockEnabledMirror; }

export type BiometricLabel = "Face ID" | "Fingerprint" | "Biometric unlock";

function labelFor(types: LocalAuthentication.AuthenticationType[]): BiometricLabel {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "Face ID";
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "Fingerprint";
  return "Biometric unlock";
}

/** Whether this device even *can* offer biometric unlock right now — has the hardware and has something enrolled in it (Face ID/fingerprint set up in the OS). */
export function useBiometricCapability() {
  const [state, setState] = useState<{ loading: boolean; supported: boolean; enrolled: boolean; label: BiometricLabel }>({ loading: true, supported: false, enrolled: false, label: "Biometric unlock" });
  useEffect(() => {
    let alive = true;
    void Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync(), LocalAuthentication.supportedAuthenticationTypesAsync()]).then(([supported, enrolled, types]) => {
      if (!alive) return;
      setState({ loading: false, supported, enrolled, label: labelFor(types) });
    }).catch(() => {
      // Must still resolve `loading`: the lock gate holds an opaque cover until it does, so a native
      // failure here would otherwise leave the app covered forever. Treat it as "can't lock".
      if (alive) setState(current => ({ ...current, loading: false, supported: false, enrolled: false }));
    });
    return () => { alive = false; };
  }, []);
  return state;
}

/** The user's saved on/off preference for the app-lock. Independent of capability — someone can enable it before enrolling; the lock gate just won't be able to actually lock until they do. */
export function useBiometricLockSetting() {
  const [enabled, setEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    void SecureStore.getItemAsync(BIOMETRIC_LOCK_ENABLED_KEY).then(value => { if (alive) { setEnabledState(value === "true"); setLoading(false); } });
    return () => { alive = false; };
  }, []);
  const setEnabled = useCallback(async (value: boolean) => {
    setEnabledState(value);
    lockEnabledMirror = value;
    await SecureStore.setItemAsync(BIOMETRIC_LOCK_ENABLED_KEY, String(value));
  }, []);
  return { enabled, setEnabled, loading };
}

/** One synchronous-from-the-caller's-perspective read of the setting, for the lock gate's initial mount — see providers/BiometricLockGate.tsx. */
export async function readBiometricLockEnabled(): Promise<boolean> {
  const value = (await SecureStore.getItemAsync(BIOMETRIC_LOCK_ENABLED_KEY)) === "true";
  lockEnabledMirror = value;
  return value;
}

/** Prompts Face ID/fingerprint (falling back to device passcode, same as the OS default everywhere else). Resolves true only on a genuine success — a user cancel or a hardware error both resolve false, never throw. */
export async function authenticate(promptMessage = "Unlock Akọ"): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: "Cancel", disableDeviceFallback: false });
    return result.success;
  } catch {
    return false;
  }
}

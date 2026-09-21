// File: hooks/useSound.tsx
//
// Silent stand-in for web's src/hooks/useSound.tsx, so hooks that call
// `play("like")` / `play("follow")` port line-for-line and nothing needs
// touching when native gets real sounds.
//
// Web's version is built on the Web Audio API (AudioContext buffers, a master
// gain that ducks under <audio>/<video> playback, localStorage-persisted
// on/off + "minimalist" mode) — all browser-only. Native equivalent would be
// expo-audio plus the sound files from public/sounds/ copied into assets/, and
// the on/off + mode settings in AsyncStorage. Until then `play` does nothing.
//
// Unlike web's, this does NOT require a <SoundProvider>: `useSound()` works
// anywhere, so there's nothing to add to app/_layout.tsx yet. If a real
// provider is added later, keep this hook's return shape.

/** Same event names as web's src/lib/sounds.ts SoundEvent. */
export type SoundEvent =
  | "message-sent"
  | "message-received"
  | "notification-generic"
  | "like"
  | "follow"
  | "gift-sent"
  | "gift-received"
  | "unlock-success"
  | "error"
  | "room-join"
  | "room-leave";

export type SoundMode = "minimalist" | "normal";

interface SoundContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  mode: SoundMode;
  setMode: (mode: SoundMode) => void;
  /** Play a registered sound event. No-op until native sound playback exists. */
  play: (event: SoundEvent) => void;
}

const noop = () => {};

const SILENT: SoundContextValue = {
  enabled: false,
  setEnabled: noop,
  mode: "normal",
  setMode: noop,
  play: noop,
};

export function useSound(): SoundContextValue {
  return SILENT;
}

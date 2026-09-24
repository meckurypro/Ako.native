// File: features/messaging/waveform.ts
//
// Web's src/lib/waveform.ts decodes the recorded blob after the fact via
// Web Audio's decodeAudioData — there's no equivalent on-device AAC/M4A
// decoder reachable from Expo/React Native (expo-audio doesn't expose PCM
// for arbitrary files, only for a live input stream). So instead of
// decoding after recording, we sample the recorder's live metering (dB)
// while the mic is held and reduce those samples to a fixed bar count —
// same contract (an array of 0..1 values, `peaks` on VoiceNotePayload) and
// same visual result, different source.
const METER_FLOOR_DB = -50; // quieter than this reads as silence; louder maps linearly to 1

export function normalizeMeterDb(db: number | undefined): number {
  if (typeof db !== "number" || Number.isNaN(db)) return 0;
  return Math.max(0, Math.min(1, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}

// Reduces a variable-length list of live samples to a fixed number of bars,
// taking the loudest sample in each bucket (mirrors the web implementation's
// per-bucket peak) with the same 0.12 floor so quiet stretches stay visible.
export function downsamplePeaks(samples: number[], barCount = 40): number[] {
  if (!samples.length) return Array.from({ length: barCount }, () => 0.12);
  const perBar = Math.max(1, Math.ceil(samples.length / barCount));
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const start = i * perBar;
    const slice = samples.slice(start, start + perBar);
    const peak = slice.length ? Math.max(...slice) : (bars[bars.length - 1] ?? 0);
    bars.push(Math.max(0.12, Math.min(1, peak)));
  }
  return bars;
}

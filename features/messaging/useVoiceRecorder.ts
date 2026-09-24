// File: features/messaging/useVoiceRecorder.ts
//
// Backs the WhatsApp-style hold-to-record UX: press and hold the mic button
// to record, drag left to cancel, drag up to lock into hands-free
// recording. Owns the expo-audio recorder plus the PanResponder and live
// waveform state; the screen wires `panHandlers` onto the mic button and
// reads `phase`/`dragX`/`dragY`/`livePeaks` to render the slide hints and
// the locked bar.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, PanResponder } from "react-native";
import { RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as Haptics from "expo-haptics";
import { ensurePermission } from "@/lib/permissions";
import { downsamplePeaks, normalizeMeterDb } from "./waveform";

export const CANCEL_THRESHOLD = 90; // px dragged left before release cancels
export const LOCK_THRESHOLD = 80; // px dragged up before release locks
export const LIVE_BAR_COUNT = 40; // bars shown while recording (most recent samples)
export const MIN_RECORD_MS = 350; // releases shorter than this are treated as an accidental tap, not a send

export type RecorderPhase = "idle" | "held" | "locked";
export type VoiceRecorderResult = { uri: string; durationSec: number; peaks: number[] };

export function useVoiceRecorder(onFinish: (result: VoiceRecorderResult) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 150);
  const recorderStateRef = useRef(recorderState);
  recorderStateRef.current = recorderState;

  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const phaseRef = useRef<RecorderPhase>("idle");
  const setPhaseBoth = (value: RecorderPhase) => { phaseRef.current = value; setPhase(value); };

  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const resetDrag = () => { dragX.setValue(0); dragY.setValue(0); };

  const samples = useRef<number[]>([]);
  const [livePeaks, setLivePeaks] = useState<number[]>([]);

  // Runs on every recorder status poll (150ms) while recording — appends one
  // metering sample and republishes the last LIVE_BAR_COUNT of them for the
  // growing preview waveform.
  useEffect(() => {
    if (!recorderState.isRecording) return;
    const level = normalizeMeterDb(recorderState.metering);
    samples.current = [...samples.current, level];
    setLivePeaks(samples.current.slice(-LIVE_BAR_COUNT));
    // recorderState.durationMillis changes once per poll tick, which is what
    // drives this — metering itself isn't a safe dep (new object each poll).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorderState.durationMillis, recorderState.isRecording]);

  const startRecording = useCallback(async () => {
    try {
      const granted = await ensurePermission("microphone");
      if (!granted) return;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      samples.current = [];
      setLivePeaks([]);
      await recorder.prepareToRecordAsync({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
      recorder.record();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhaseBoth("held");
    } catch {
      Alert.alert("Couldn't start recording", "Please try again.");
      setPhaseBoth("idle");
    }
  }, [recorder]);

  const stopAndReset = useCallback(async () => {
    try { await recorder.stop(); } catch { /* already stopped/never started */ }
    finally { void setAudioModeAsync({ allowsRecording: false }); }
  }, [recorder]);

  const cancelRecording = useCallback(async () => {
    await stopAndReset();
    samples.current = [];
    setLivePeaks([]);
    setPhaseBoth("idle");
  }, [stopAndReset]);

  const finishRecording = useCallback(async () => {
    const durationSec = Math.max(1, recorderStateRef.current.durationMillis / 1000);
    const peaks = downsamplePeaks(samples.current);
    await stopAndReset();
    const uri = recorder.uri;
    setPhaseBoth("idle");
    if (uri) onFinish({ uri, durationSec, peaks });
  }, [recorder, stopAndReset, onFinish]);

  // Recreated only when the underlying handlers change identity (i.e. almost
  // never, since they're all useCallback-memoized) rather than frozen once
  // via a bare useRef — avoids the classic PanResponder-closure-goes-stale bug.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => { void startRecording(); },
        onPanResponderMove: (_evt, gesture) => {
          dragX.setValue(Math.min(0, gesture.dx));
          dragY.setValue(Math.min(0, gesture.dy));
          if (phaseRef.current === "held" && gesture.dy < -LOCK_THRESHOLD) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setPhaseBoth("locked");
            resetDrag();
          }
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (phaseRef.current !== "held") { resetDrag(); return; } // already locked, or never started
          const tooShort = recorderStateRef.current.durationMillis < MIN_RECORD_MS;
          if (tooShort || gesture.dx < -CANCEL_THRESHOLD) void cancelRecording();
          else void finishRecording();
          resetDrag();
        },
        onPanResponderTerminate: () => {
          if (phaseRef.current === "held") void cancelRecording();
          resetDrag();
        },
      }),
    [startRecording, cancelRecording, finishRecording], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    phase,
    panHandlers: panResponder.panHandlers,
    dragX,
    dragY,
    livePeaks,
    durationMillis: recorderState.durationMillis,
    cancelRecording,
    finishRecording,
  };
}

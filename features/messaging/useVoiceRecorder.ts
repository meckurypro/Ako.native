// File: features/messaging/useVoiceRecorder.ts
//
// Backs the WhatsApp-style hold-to-record UX: press and hold the mic button
// to record, drag left to cancel, drag up to lock into hands-free
// recording. Owns the expo-audio recorder plus the PanResponder and live
// waveform state; the screen wires `panHandlers` onto the mic button and
// reads `phase`/`dragX`/`dragY`/`livePeaks` to render the slide hints and
// the locked bar. While locked, recording can be paused and resumed.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, AppState, PanResponder } from "react-native";
import { RecordingPresets, getRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
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

  // Whether the OS has already granted the mic. Kept current on mount and on every foreground so the
  // press handler can decide synchronously: the permission dialogs must never be raised from inside
  // the touch responder, because the dialog steals the touch and the resulting
  // onPanResponderTerminate would cancel the recording that had just begun.
  const micGranted = useRef(false);
  useEffect(() => {
    let alive = true;
    const refresh = () => { void getRecordingPermissionsAsync().then(result => { if (alive) micGranted.current = result.granted; }).catch(() => undefined); };
    refresh();
    const subscription = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    return () => { alive = false; subscription.remove(); };
  }, []);

  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const phaseRef = useRef<RecorderPhase>("idle");
  const setPhaseBoth = (value: RecorderPhase) => { phaseRef.current = value; setPhase(value); };

  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const resetDrag = () => { dragX.setValue(0); dragY.setValue(0); };

  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const setPausedBoth = (value: boolean) => { pausedRef.current = value; setPaused(value); };

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

  // Runs the rationale -> OS prompt -> blocked-Settings flow (lib/permissions.ts) *outside* any gesture.
  // Nothing records yet: the press that triggered this has already ended, so on success we just tell
  // the person to hold the mic again.
  const requestMicPermission = useCallback(async () => {
    const already = await getRecordingPermissionsAsync().catch(() => null);
    if (already?.granted) { micGranted.current = true; return; }
    const granted = await ensurePermission("microphone");
    micGranted.current = granted;
    if (granted) Alert.alert("Microphone ready", "Hold the mic button to record a voice note.");
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setPausedBoth(false);
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
    setPausedBoth(false);
    setPhaseBoth("idle");
  }, [stopAndReset]);

  const finishRecording = useCallback(async () => {
    const durationSec = Math.max(1, recorderStateRef.current.durationMillis / 1000);
    const peaks = downsamplePeaks(samples.current);
    await stopAndReset();
    const uri = recorder.uri;
    setPausedBoth(false);
    setPhaseBoth("idle");
    if (uri) onFinish({ uri, durationSec, peaks });
  }, [recorder, stopAndReset, onFinish]);

  // Locked-bar controls. pause() stops the file and the metering poll (isRecording goes false, so the
  // effect above stops sampling and the waveform holds still); record() on a paused recorder resumes it.
  const pauseRecording = useCallback(() => {
    if (phaseRef.current !== "locked" || pausedRef.current) return;
    try { recorder.pause(); setPausedBoth(true); } catch { Alert.alert("Couldn't pause recording", "Please try again."); }
  }, [recorder]);
  const resumeRecording = useCallback(() => {
    if (phaseRef.current !== "locked" || !pausedRef.current) return;
    try { recorder.record(); setPausedBoth(false); } catch { Alert.alert("Couldn't resume recording", "Please try again."); }
  }, [recorder]);

  // Recreated only when the underlying handlers change identity (i.e. almost
  // never, since they're all useCallback-memoized) rather than frozen once
  // via a bare useRef — avoids the classic PanResponder-closure-goes-stale bug.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          if (!micGranted.current) { void requestMicPermission(); return; }
          void startRecording();
        },
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
    [startRecording, requestMicPermission, cancelRecording, finishRecording], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    phase,
    panHandlers: panResponder.panHandlers,
    dragX,
    dragY,
    livePeaks,
    durationMillis: recorderState.durationMillis,
    paused,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    finishRecording,
  };
}

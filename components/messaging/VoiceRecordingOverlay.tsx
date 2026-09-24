// File: components/messaging/VoiceRecordingOverlay.tsx
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/core/Icon";
import { Text } from "@/components/core";
import { useTheme } from "@/providers/ThemeProvider";
import { CANCEL_THRESHOLD, LOCK_THRESHOLD, type RecorderPhase } from "@/features/messaging/useVoiceRecorder";

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// A small live waveform — same visual language as the sent-message bubble,
// just growing left-to-right as bars arrive instead of showing playback
// progress.
function LiveWaveform({ peaks, color }: { peaks: number[]; color: string }) {
  return (
    <View style={waveStyles.row}>
      {peaks.map((level, index) => (
        <View key={index} style={[waveStyles.bar, { height: 4 + level * 22, backgroundColor: color }]} />
      ))}
    </View>
  );
}

type HeldProps = { dragX: Animated.Value; dragY: Animated.Value; durationMillis: number };

// Shown while the finger is still down on the mic button: a duration timer,
// a "slide to cancel" hint that tracks the horizontal drag, and a lock icon
// that slides up and fades in as the vertical drag approaches the lock
// threshold.
export function VoiceRecordingHeldHint({ dragX, dragY, durationMillis }: HeldProps) {
  const { colors } = useTheme();
  const cancelOpacity = dragX.interpolate({ inputRange: [-CANCEL_THRESHOLD, 0], outputRange: [0.4, 1], extrapolate: "clamp" });
  const lockTranslate = dragY.interpolate({ inputRange: [-LOCK_THRESHOLD, 0], outputRange: [-LOCK_THRESHOLD, 0], extrapolate: "clamp" });
  const lockOpacity = dragY.interpolate({ inputRange: [-LOCK_THRESHOLD, -8, 0], outputRange: [0, 1, 1], extrapolate: "clamp" });
  return (
    <View pointerEvents="none" style={[held.root, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <View style={[held.dot, { backgroundColor: colors.danger }]} />
      <Text style={held.timer}>{formatDuration(durationMillis)}</Text>
      <Animated.View style={[held.cancelHint, { opacity: cancelOpacity, transform: [{ translateX: dragX }] }]}>
        <Icon name="chevron-left" size={16} color={colors.textMuted} />
        <Text color="muted" style={held.cancelText}>Slide to cancel</Text>
      </Animated.View>
      <Animated.View style={[held.lock, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, opacity: lockOpacity, transform: [{ translateY: lockTranslate }] }]}>
        <Icon name="lock" size={15} color={colors.accent} />
      </Animated.View>
    </View>
  );
}

type LockedProps = { peaks: number[]; durationMillis: number; paused: boolean; onTogglePause: () => void; onCancel: () => void; onSend: () => void };

// Shown once locked: recording continues hands-free. Trash discards, the pause button holds the
// recording (send and discard keep working while paused), the accent button sends — same as the
// tap-to-record preview bar below it.
export function VoiceRecordingLockedBar({ peaks, durationMillis, paused, onTogglePause, onCancel, onSend }: LockedProps) {
  const { colors } = useTheme();
  return (
    <View style={[locked.root, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <Pressable onPress={onCancel} style={locked.iconButton} accessibilityLabel="Discard recording">
        <Icon name="trash-2" size={20} color={colors.danger} />
      </Pressable>
      <View style={[locked.wave, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <View style={[locked.dot, { backgroundColor: paused ? colors.textMuted : colors.danger }]} />
        <LiveWaveform peaks={peaks} color={paused ? colors.textMuted : colors.accent} />
        <Text style={locked.timer}>{formatDuration(durationMillis)}</Text>
      </View>
      <Pressable onPress={onTogglePause} style={locked.iconButton} accessibilityLabel={paused ? "Resume recording" : "Pause recording"}>
        <Icon name={paused ? "play" : "pause"} size={20} color={colors.accent} />
      </Pressable>
      <Pressable onPress={onSend} style={[locked.send, { backgroundColor: colors.accent }]} accessibilityLabel="Send voice note">
        <Icon name="send" size={19} color="#07130D" />
      </Pressable>
    </View>
  );
}

const waveStyles = StyleSheet.create({ row: { flex: 1, flexDirection: "row", alignItems: "center", gap: 2, height: 26, overflow: "hidden" }, bar: { width: 2, borderRadius: 2 } });
const held = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth },
  dot: { width: 9, height: 9, borderRadius: 5 },
  timer: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  cancelHint: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2, paddingRight: 46 },
  cancelText: { fontSize: 13 },
  lock: { position: "absolute", right: 6, top: -46, width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
const locked = StyleSheet.create({
  root: { minHeight: 61, paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 39, height: 39, alignItems: "center", justifyContent: "center" },
  wave: { flex: 1, height: 42, borderWidth: 1, borderRadius: 21, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  timer: { fontSize: 12, fontVariant: ["tabular-nums"] },
  send: { height: 39, width: 39, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});

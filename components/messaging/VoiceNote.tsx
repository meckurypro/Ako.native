import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/core/Icon";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Text } from "@/components/core";
import { formatVoiceDuration } from "@/features/messaging/api";
import { getSignedAudioUrl } from "@/lib/media-cache";
import { getVoicePlaybackPosition, saveVoicePlaybackPosition } from "@/features/messaging/voicePlaybackPosition";
import { useTheme } from "@/providers/ThemeProvider";

const SPEEDS = [1, 1.5, 2] as const;

// Voice notes sent before real peaks were captured (see features/messaging/waveform.ts)
// have no `peaks` field — fall back to the old deterministic pattern rather than
// hiding the waveform for old messages.
function fallbackPeaks() {
  return Array.from({ length: 30 }, (_, i) => 0.3 + ((i * 7) % 19) / 19 * 0.6);
}

type Props = { id: string; path: string; durationSec: number; peaks?: number[]; own: boolean; viewOnce?: boolean; openedOnce?: boolean; onOpenedOnce?: () => void };

// Signed URLs are cached on-device (lib/media-cache.ts, backed by
// lib/sqlite.ts's signed_urls_cache table) so scrolling a bubble in and out
// of view, or replaying it, doesn't re-request a signed URL from Supabase
// every time — only the first play (or once the cached URL is near its 1hr
// expiry) actually hits the network.
export function VoiceNote({ id, path, durationSec, peaks, own, viewOnce, openedOnce, onOpenedOnce }: Props) {
  const { colors } = useTheme();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const player = useAudioPlayer(url, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  // justFinished gives instant UI feedback the moment playback ends, before the
  // opened_once_at write (see onOpenedOnce) round-trips back into the openedOnce
  // prop via react-query's optimistic cache patch. openedOnce itself is what
  // makes the "already opened" state survive a remount — a scroll out/in of the
  // FlatList, backgrounding the app, or reopening the conversation later — since
  // it's read from message_user_state, not from this component's own memory.
  const [justFinished, setJustFinished] = useState(false);
  const spent = !!viewOnce && !own && (!!openedOnce || justFinished);
  const [speedIndex, setSpeedIndex] = useState(0);
  const waveWidth = useRef(0);
  const restoredRef = useRef(false);
  const latestStatus = useRef({ currentTime: 0, duration: 0 });
  const bars = peaks?.length ? peaks : fallbackPeaks();

  useEffect(() => {
    if (spent) return; // already consumed (possibly from a prior session) — no need to sign a URL that will never play
    let alive = true;
    // A voice note still waiting in the offline outbox has a local file path instead of a storage path.
    (path.startsWith("file:") ? Promise.resolve(path) : getSignedAudioUrl(path)).then(signedUrl => {
      if (!alive) return;
      if (!signedUrl) { setFailed(true); return; }
      setUrl(signedUrl);
    });
    return () => { alive = false; };
  }, [path, spent]);

  useEffect(() => { if (viewOnce && !own && status.didJustFinish && !spent) { setJustFinished(true); onOpenedOnce?.(); } }, [own, status.didJustFinish, viewOnce, spent, onOpenedOnce]);

  // Resume from where the listener left off, once, right after the player loads.
  useEffect(() => {
    if (restoredRef.current || !status.isLoaded || status.duration <= 0) return;
    restoredRef.current = true;
    const remembered = getVoicePlaybackPosition(id);
    if (remembered > 0.5 && remembered < status.duration - 0.5) void player.seekTo(remembered);
  }, [status.isLoaded, status.duration, id, player]);

  // Keep a ref of the latest position so the unmount cleanup below (which
  // only runs once, with a closure from mount time) can still read it fresh.
  useEffect(() => { latestStatus.current = { currentTime: status.currentTime, duration: status.duration }; });

  const persistIfMidway = (currentTime: number, duration: number) => {
    if (currentTime > 0.5 && duration > 0 && currentTime < duration - 0.5) saveVoicePlaybackPosition(id, currentTime);
  };
  // Save whenever playback pauses mid-way (covers the common "listened to some, paused" case).
  useEffect(() => { if (!status.playing) persistIfMidway(status.currentTime, status.duration); }, [status.playing, status.currentTime, status.duration]); // eslint-disable-line react-hooks/exhaustive-deps
  // Save on unmount too (e.g. scrolled out of view mid-playback), reading the live ref.
  useEffect(() => () => persistIfMidway(latestStatus.current.currentTime, latestStatus.current.duration), [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;

  const seekToFraction = (fraction: number) => {
    if (!status.isLoaded || status.duration <= 0) return;
    void player.seekTo(Math.max(0, Math.min(1, fraction)) * status.duration);
  };
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => { if (waveWidth.current > 0) seekToFraction(evt.nativeEvent.locationX / waveWidth.current); },
      onPanResponderMove: evt => { if (waveWidth.current > 0) seekToFraction(evt.nativeEvent.locationX / waveWidth.current); },
    }),
  ).current;

  const toggle = async () => {
    if (!url) return;
    if (status.playing) { player.pause(); return; }
    const finished = status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - .05);
    try { if (finished) await player.seekTo(0); player.play(); } catch { setFailed(true); }
  };

  const cycleSpeed = () => {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    player.setPlaybackRate(SPEEDS[next]);
  };

  if (spent) return <View style={s.spent}><Icon name="eye-off" size={16} color={colors.textMuted} /><Text color="muted" style={s.spentText}>Opened</Text></View>;

  return (
    <View style={s.root}>
      <Pressable onPress={() => void toggle()} style={[s.play, { backgroundColor: own ? "#fff" : colors.accent }]}>
        {!url ? <ActivityIndicator size="small" color={colors.accent} /> : <Icon name={status.playing ? "pause" : "play"} size={18} color={own ? colors.accent : "#07130D"} />}
      </Pressable>
      <View style={s.wave} onLayout={e => { waveWidth.current = e.nativeEvent.layout.width; }} {...panResponder.panHandlers}>
        <View style={[s.waveFill, { backgroundColor: own ? "rgba(255,255,255,.92)" : colors.accent, width: `${Math.max(3, progress * 100)}%` }]} />
        {bars.map((level, i) => <View key={i} style={[s.bar, { height: 6 + level * 22, backgroundColor: own ? "rgba(255,255,255,.34)" : "rgba(140,150,145,.3)" }]} />)}
      </View>
      <View style={s.info}>
        {viewOnce && <View style={[s.once, { backgroundColor: own ? "rgba(255,255,255,.2)" : colors.accentSoft }]}><Text style={[s.onceText, { color: own ? "#fff" : colors.accent }]}>1</Text></View>}
        <Pressable onPress={cycleSpeed} style={[s.speed, { backgroundColor: own ? "rgba(255,255,255,.18)" : colors.surfaceElevated }]}><Text style={[s.speedText, { color: own ? "#fff" : colors.textMuted }]}>{SPEEDS[speedIndex]}x</Text></Pressable>
        <Text style={[s.duration, { color: own ? "rgba(255,255,255,.82)" : colors.textMuted }]}>{formatVoiceDuration(status.playing || status.currentTime > 0 ? status.currentTime : durationSec)}</Text>
        {failed && <Text color="muted" style={s.fail}>Unavailable</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { minWidth: 210, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  play: { width: 35, height: 35, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  wave: { height: 33, flex: 1, overflow: "hidden", flexDirection: "row", alignItems: "center", gap: 2, position: "relative" },
  waveFill: { position: "absolute", left: 0, top: 0, bottom: 0, opacity: .25 },
  bar: { width: 2, borderRadius: 2 },
  info: { alignItems: "flex-end", gap: 3 },
  duration: { fontSize: 10, fontVariant: ["tabular-nums"] },
  once: { width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  onceText: { fontSize: 9, fontWeight: "800" },
  speed: { paddingHorizontal: 6, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  speedText: { fontSize: 9, fontWeight: "800", fontVariant: ["tabular-nums"] },
  spent: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  spentText: { fontStyle: "italic", fontSize: 14 },
  fail: { fontSize: 9 },
});

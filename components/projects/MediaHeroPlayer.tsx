// File: components/projects/MediaHeroPlayer.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useEventListener } from "expo";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { Icon, Text } from "@/components/core";
import { fonts } from "@/theme/fonts";

// A Media project's hero: the card's own thumbnail doubles as the player. Access-gated like everything else: a locked project shows a dimmed thumbnail with a lock, never the media.
// Plays a looped preview capped at PREVIEW_SECONDS (same cap as web's MediaPreviewPlayer). Fills its parent, which supplies the aspect ratio.
export const PREVIEW_SECONDS = 30;

type Props = { kind: "audio" | "video"; thumbnailUrl: string | null; hasAccess: boolean; previewSrc: string | null; isLoadingPreview: boolean; onLoadPreview: () => void; autoLoadOnMount: boolean };

function Backdrop({ thumbnailUrl, kind, dim }: { thumbnailUrl: string | null; kind: "audio" | "video"; dim?: boolean }) {
  return (
    <>
      {thumbnailUrl ? <Image source={{ uri: thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: "#1c1c19" }]}><Icon name={kind === "video" ? "video" : "music"} size={32} color="#7C786F" /></View>}
      {dim ? <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]} /> : null}
    </>
  );
}

function Controls({ playing, busy, elapsed, showProgress }: { playing: boolean; busy: boolean; elapsed: number; showProgress: boolean }) {
  const pct = Math.min(100, (elapsed / PREVIEW_SECONDS) * 100);
  return (
    <>
      <View pointerEvents="none" style={s.center}><View style={s.playButton}>{busy ? <ActivityIndicator color="#fff" /> : <Icon name={playing ? "pause" : "play"} size={22} color="#fff" fill="#fff" />}</View></View>
      {showProgress ? <View pointerEvents="none" style={s.progressWrap}><View style={s.track}><View style={[s.fill, { width: `${pct}%` }]} /></View><Text style={s.progressText}>{Math.min(PREVIEW_SECONDS, Math.floor(elapsed))}s/{PREVIEW_SECONDS}s</Text></View> : null}
    </>
  );
}

function VideoHero({ thumbnailUrl, previewSrc, isLoadingPreview, onLoadPreview }: Omit<Props, "kind" | "hasAccess" | "autoLoadOnMount">) {
  const player = useVideoPlayer(previewSrc, instance => { instance.loop = true; instance.timeUpdateEventInterval = 0.25; });
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEventListener(player, "playingChange", ({ isPlaying }) => setPlaying(isPlaying));
  // Loop inside the preview cap instead of playing on to the end of the file.
  useEventListener(player, "timeUpdate", ({ currentTime }) => { if (currentTime >= PREVIEW_SECONDS) { player.replay(); setElapsed(0); return; } setElapsed(currentTime); });
  useEffect(() => { if (!previewSrc) return; player.replay(); }, [player, previewSrc]);
  useFocusEffect(useCallback(() => () => player.pause(), [player]));
  const toggle = () => { if (!previewSrc) { onLoadPreview(); return; } if (playing) player.pause(); else player.play(); };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={playing ? "Pause video" : "Play video"} onPress={toggle} disabled={isLoadingPreview && !previewSrc} style={StyleSheet.absoluteFill}>
      {previewSrc ? <VideoView player={player} nativeControls={false} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Backdrop thumbnailUrl={thumbnailUrl} kind="video" />}
      <Controls playing={playing} busy={isLoadingPreview && !previewSrc} elapsed={elapsed} showProgress={!!previewSrc} />
    </Pressable>
  );
}

function AudioHero({ thumbnailUrl, previewSrc, isLoadingPreview, onLoadPreview }: Omit<Props, "kind" | "hasAccess" | "autoLoadOnMount">) {
  const player = useAudioPlayer(previewSrc, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const started = useRef<string | null>(null);
  // Autoplay once the signed URL has loaded, then loop within the cap.
  useEffect(() => { if (previewSrc && status.isLoaded && started.current !== previewSrc) { started.current = previewSrc; void player.seekTo(0).then(() => player.play()).catch(() => undefined); } }, [player, previewSrc, status.isLoaded]);
  useEffect(() => { if (!previewSrc) return; if (status.currentTime >= PREVIEW_SECONDS || status.didJustFinish) void player.seekTo(0).then(() => player.play()).catch(() => undefined); }, [player, previewSrc, status.currentTime, status.didJustFinish]);
  useFocusEffect(useCallback(() => () => player.pause(), [player]));
  const toggle = () => { if (!previewSrc) { onLoadPreview(); return; } if (status.playing) player.pause(); else player.play(); };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? "Pause audio" : "Play audio"} onPress={toggle} disabled={isLoadingPreview && !previewSrc} style={StyleSheet.absoluteFill}>
      <Backdrop thumbnailUrl={thumbnailUrl} kind="audio" />
      <Controls playing={status.playing} busy={isLoadingPreview && !previewSrc} elapsed={Math.min(PREVIEW_SECONDS, status.currentTime)} showProgress={!!previewSrc} />
    </Pressable>
  );
}

export function MediaHeroPlayer({ kind, thumbnailUrl, hasAccess, previewSrc, isLoadingPreview, onLoadPreview, autoLoadOnMount }: Props) {
  const requested = useRef(false);
  // Only the single-card detail view fetches + autoplays on mount; a list of these must not sign a URL per card just for being on screen.
  useEffect(() => { if (!autoLoadOnMount || !hasAccess || previewSrc || requested.current) return; requested.current = true; onLoadPreview(); }, [autoLoadOnMount, hasAccess, onLoadPreview, previewSrc]);
  if (!hasAccess) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <Backdrop thumbnailUrl={thumbnailUrl} kind={kind} dim />
        <View style={s.center}><Icon name="lock" size={20} color="#fff" /><Text style={s.lockText}>{kind === "video" ? "Video locked" : "Audio locked"}</Text></View>
      </View>
    );
  }
  return kind === "video" ? <VideoHero thumbnailUrl={thumbnailUrl} previewSrc={previewSrc} isLoadingPreview={isLoadingPreview} onLoadPreview={onLoadPreview} /> : <AudioHero thumbnailUrl={thumbnailUrl} previewSrc={previewSrc} isLoadingPreview={isLoadingPreview} onLoadPreview={onLoadPreview} />;
}

const s = StyleSheet.create({
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 6 },
  playButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  lockText: { color: "#fff", fontSize: 12, lineHeight: 16, fontFamily: fonts.body.semibold },
  progressWrap: { position: "absolute", left: 12, right: 12, bottom: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)", overflow: "hidden" },
  fill: { height: 3, backgroundColor: "#fff" },
  progressText: { color: "#fff", fontSize: 11, lineHeight: 14, fontVariant: ["tabular-nums"] },
});

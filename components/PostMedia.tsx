// File: components/PostMedia.tsx
// Port of web's src/components/PostMedia.tsx.
//
// A single post's attached media. One image renders as a simple
// bounded box (tap opens the fullscreen viewer); more than one renders
// as an inline "slides" carousel — see SlideCarousel below. isVideoUrl
// handling is kept for posts uploaded before videos were disallowed;
// new uploads can no longer produce a video URL here.
//
// Web hand-rolls the carousel's touch tracking (raw touchstart/move/end
// listeners, axis lock, edge resistance, commit ratio + velocity) —
// the same technique components/SwipeableTabs.tsx used to use for the
// top-level feed tabs. This native port takes the same approach that
// file's native version already settled on: a horizontal paging
// ScrollView instead of reimplementing gesture physics by hand. The OS
// already does finger tracking, axis lock (directionalLockEnabled
// keeps a vertical scroll in the surrounding feed from being
// hijacked), and the flick/commit decision (pagingEnabled +
// decelerationRate="fast"). A tap that isn't a drag opens the
// fullscreen viewer via a Pressable per slide — RN's ScrollView
// already tells a tap from a scroll gesture on its own, unlike web
// where that distinction needed its own maxMove bookkeeping.
//
// Not ported: web's desktop-only chevron arrow buttons ("hidden
// sm:flex") — a touch-only native app has no pointer-device fallback
// to build.
import { useEffect, useState } from "react";
import {
  Image as RNImage,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { isVideoUrl } from "../hooks/useUploadPostMedia";
import { MediaViewer } from "./MediaViewer";
import { useTheme, withAlpha } from "../lib/theme";

const MIN_ASPECT = 0.5;
const MAX_ASPECT = 1.91;

// Placeholder for a legacy video attachment — playback isn't wired up
// natively yet (needs a video-capable component such as expo-video,
// not currently a project dependency). New posts can no longer attach
// video, so this only ever shows on posts from before that
// restriction. Tapping it still opens MediaViewer, which shows the
// same placeholder full-screen.
function VideoPlaceholder() {
  const { colors } = useTheme();
  return (
    <View style={[styles.fill, styles.videoPlaceholder, { backgroundColor: colors.ink }]}>
      <Text style={styles.videoPlaceholderText}>▶</Text>
    </View>
  );
}

function Slide({ url }: { url: string }) {
  if (isVideoUrl(url)) return <VideoPlaceholder />;
  return <RNImage source={{ uri: url }} style={styles.fill} resizeMode="cover" />;
}

interface SlideCarouselProps {
  mediaUrls: string[];
  onTap: (index: number) => void;
  // Overrides the default first-slide-aspect-ratio frame with a fixed
  // height — used by RepostEmbed, whose compact embedded card always
  // shows a fixed-height thumbnail rather than a full aspect-ratio card.
  fixedHeight?: number;
}

export function SlideCarousel({ mediaUrls, onTap, fixedHeight }: SlideCarouselProps) {
  const { colors } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [frameAspect, setFrameAspect] = useState(1);
  const count = mediaUrls.length;

  // Carousel frame follows the FIRST slide's aspect ratio (same
  // convention Instagram/Threads carousels use — one shared frame, not
  // one height per slide), clamped so one unusually tall/wide first
  // image can't force every other slide into an awkward crop. Skipped
  // when fixedHeight is given.
  useEffect(() => {
    if (fixedHeight || isVideoUrl(mediaUrls[0])) return;
    let cancelled = false;
    RNImage.getSize(
      mediaUrls[0],
      (w, h) => {
        if (!cancelled) setFrameAspect(Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, w / h)));
      },
      () => {}
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaUrls[0], fixedHeight]);

  function handleMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!containerWidth) return;
    const next = Math.max(0, Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.x / containerWidth)));
    setIndex(next);
  }

  const frameStyle = fixedHeight ? { height: fixedHeight } : { aspectRatio: frameAspect };

  return (
    <View
      style={fixedHeight ? styles.fullWidth : styles.eightyWidth}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <View style={[styles.frame, frameStyle, { backgroundColor: colors.canvas, borderColor: colors.border }]}>
        {containerWidth > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            decelerationRate="fast"
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={handleMomentumEnd}
          >
            {mediaUrls.map((url, i) => (
              <Pressable key={i} onPress={() => onTap(i)} style={{ width: containerWidth }}>
                <Slide url={url} />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Dot indicators — the active dot stretches into a short pill
            instead of just changing color (same idea as iOS's page
            control), which stays legible past ~4-5 slides where a row
            of plain same-size dots starts to blur together. */}
        <View style={styles.dotsWrap} pointerEvents="none">
          <View style={styles.dotsRow}>
            {mediaUrls.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: i === index ? 16 : 6,
                    backgroundColor: i === index ? "#FFFFFF" : withAlpha("#FFFFFF", 0.5),
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Slide counter — kept alongside the dots since a count like
            "12" isn't legible as dots alone. */}
        <View style={styles.counter} pointerEvents="none">
          <Text style={styles.counterText}>
            {index + 1}/{count}
          </Text>
        </View>
      </View>
    </View>
  );
}

// Single-image case keeps the media's own aspect ratio (no crop) at
// 80% of the card's width — web: block w-full h-auto inside a w-[80%]
// frame. RN's Image needs an explicit height, so this measures the
// natural size once and derives it, same technique as SlideCarousel's
// frame-aspect tracking.
function SingleMedia({ url }: { url: string }) {
  const [aspect, setAspect] = useState(1);

  useEffect(() => {
    if (isVideoUrl(url)) return;
    let cancelled = false;
    RNImage.getSize(
      url,
      (w, h) => {
        if (!cancelled) setAspect(w / h);
      },
      () => {}
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (isVideoUrl(url)) {
    return (
      <View style={[styles.singleVideoBox, styles.videoPlaceholder]}>
        <Text style={styles.videoPlaceholderText}>▶</Text>
      </View>
    );
  }

  return <RNImage source={{ uri: url }} style={[styles.fullWidth, { aspectRatio: aspect }]} resizeMode="cover" />;
}

export function PostMedia({ mediaUrls }: { mediaUrls: string[] }) {
  const { colors } = useTheme();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (mediaUrls.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {mediaUrls.length === 1 ? (
        <Pressable
          onPress={() => setViewerIndex(0)}
          style={[styles.singleFrame, { backgroundColor: colors.canvas, borderColor: colors.border }]}
        >
          <SingleMedia url={mediaUrls[0]} />
        </Pressable>
      ) : (
        <SlideCarousel mediaUrls={mediaUrls} onTap={setViewerIndex} />
      )}

      {viewerIndex !== null && (
        <MediaViewer mediaUrls={mediaUrls} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  fill: { width: "100%", height: "100%" },
  fullWidth: { width: "100%" },
  eightyWidth: { width: "80%" },
  frame: { borderRadius: 16, overflow: "hidden", borderWidth: 1 },
  singleFrame: { width: "80%", borderRadius: 16, overflow: "hidden", borderWidth: 1 },
  singleVideoBox: { width: "100%", aspectRatio: 16 / 9 },
  videoPlaceholder: { alignItems: "center", justifyContent: "center" },
  videoPlaceholderText: { color: "#FFFFFF", fontSize: 28 },
  dotsWrap: { position: "absolute", bottom: 10, left: 0, right: 0, alignItems: "center" },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: withAlpha("#000000", 0.4),
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dot: { height: 6, borderRadius: 3 },
  counter: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: withAlpha("#000000", 0.5),
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  counterText: { color: "#FFFFFF", fontSize: 12, fontWeight: "500" },
});

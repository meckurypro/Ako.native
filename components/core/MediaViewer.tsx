import { useEffect, useMemo, useState } from "react";
import { Modal, StyleSheet, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { IconButton } from "@/components/core";

export type MediaViewerItem = { uri: string; type?: "image" | "video" };

const COMMIT_RATIO = .2;
const COMMIT_VELOCITY = 500;
const EDGE_RESISTANCE = 2.5;
const MIN_SCALE = 1;
const ZOOM_SCALE = 2.5;
const MAX_SCALE = 4;
const SNAP_BACK_THRESHOLD = 1.05;
const DISMISS_THRESHOLD = 120;
const DISMISS_VELOCITY = 800;

/** Video with a short pause/replay-on-visibility toggle, matching MediaHeroPlayer's pattern. */
function ViewerVideo({ uri, width, height, active }: { uri: string; width: number; height: number; active: boolean }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (instance) => { instance.loop = true; });
  useEffect(() => {
    if (active) player.play(); else player.pause();
  }, [active, player]);
  return <VideoView player={player} style={{ width, height, backgroundColor: "#000" }} nativeControls contentFit="contain" />;
}

/** One slide: owns its own zoom/pan state; resets whenever it stops being active. */
function ViewerSlide({
  item, width, height, active, onRequestDismiss, onZoomChange,
}: {
  item: MediaViewerItem; width: number; height: number; active: boolean;
  onRequestDismiss: (translationY: number, velocityY: number) => void;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const isVideo = item.type === "video";
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const imgX = useSharedValue(0);
  const imgY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      scale.set(1); savedScale.set(1);
      imgX.set(0); imgY.set(0); savedX.set(0); savedY.set(0);
    }
  }, [active, scale, savedScale, imgX, imgY, savedX, savedY]);

  const bounds = (currentScale: number) => ({
    x: Math.max(0, (width * (currentScale - 1)) / 2),
    y: Math.max(0, (height * (currentScale - 1)) / 2),
  });

  const pinch = Gesture.Pinch()
    .enabled(!isVideo)
    .onUpdate((event) => {
      "worklet";
      scale.set(Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * event.scale)));
      runOnJS(onZoomChange)(scale.value > SNAP_BACK_THRESHOLD);
    })
    .onEnd(() => {
      "worklet";
      if (scale.value < SNAP_BACK_THRESHOLD) {
        scale.set(withTiming(1, { duration: 180 }));
        imgX.set(withTiming(0, { duration: 180 }));
        imgY.set(withTiming(0, { duration: 180 }));
        savedX.set(0); savedY.set(0);
        runOnJS(onZoomChange)(false);
      }
      savedScale.set(scale.value);
    });

  const doubleTap = Gesture.Tap()
    .enabled(!isVideo)
    .numberOfTaps(2)
    .onEnd((event) => {
      "worklet";
      const next = scale.value > SNAP_BACK_THRESHOLD ? 1 : ZOOM_SCALE;
      scale.set(withTiming(next, { duration: 220 }));
      savedScale.set(next);
      if (next === 1) {
        imgX.set(withTiming(0, { duration: 220 }));
        imgY.set(withTiming(0, { duration: 220 }));
        savedX.set(0); savedY.set(0);
      } else {
        const limit = bounds(next);
        const targetX = Math.min(limit.x, Math.max(-limit.x, -(event.x - width / 2) * (next - 1) / next));
        const targetY = Math.min(limit.y, Math.max(-limit.y, -(event.y - height / 2) * (next - 1) / next));
        imgX.set(withTiming(targetX, { duration: 220 }));
        imgY.set(withTiming(targetY, { duration: 220 }));
        savedX.set(targetX); savedY.set(targetY);
      }
      runOnJS(onZoomChange)(next > SNAP_BACK_THRESHOLD);
    });

  const zoomPan = Gesture.Pan()
    .enabled(!isVideo)
    .onUpdate((event) => {
      "worklet";
      if (scale.value <= SNAP_BACK_THRESHOLD) return;
      const limit = bounds(scale.value);
      imgX.set(Math.min(limit.x, Math.max(-limit.x, savedX.value + event.translationX)));
      imgY.set(Math.min(limit.y, Math.max(-limit.y, savedY.value + event.translationY)));
    })
    .onEnd(() => {
      "worklet";
      savedX.set(imgX.value); savedY.set(imgY.value);
    })
    .minPointers(1)
    .maxPointers(1);

  const dismissPan = Gesture.Pan()
    .enabled(active)
    .onUpdate((event) => {
      "worklet";
      if (scale.value > SNAP_BACK_THRESHOLD) return;
      if (event.translationY > 0) runOnJS(onRequestDismiss)(event.translationY, event.velocityY);
    })
    .onEnd((event) => {
      "worklet";
      if (scale.value > SNAP_BACK_THRESHOLD) return;
      runOnJS(onRequestDismiss)(event.translationY > 0 ? -1 : 0, event.velocityY);
    });

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: imgX.value }, { translateY: imgY.value }, { scale: scale.value }],
  }));

  const composed = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, Gesture.Race(zoomPan, dismissPan)));

  return <GestureDetector gesture={composed}>
    <Animated.View style={[{ width, height, alignItems: "center", justifyContent: "center" }, zoomStyle]}>
      {isVideo
        ? <ViewerVideo uri={item.uri} width={width} height={height} active={active} />
        : <Image source={{ uri: item.uri }} style={{ width, height }} contentFit="contain" transition={160} cachePolicy="memory-disk" />}
    </Animated.View>
  </GestureDetector>;
}

export function MediaViewer({
  visible, items, initialIndex = 0, onClose, labelPrefix = "media",
}: {
  visible: boolean; items: MediaViewerItem[]; initialIndex?: number; onClose: () => void; labelPrefix?: string;
}) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const [openedFor, setOpenedFor] = useState<boolean | null>(null);
  const currentIndex = useSharedValue(initialIndex);
  const pageX = useSharedValue(-initialIndex * width);
  const dismissY = useSharedValue(0);
  const axis = useSharedValue<"x" | "y" | null>(null);

  // Reset-on-open, done during render (not an effect) per React's
  // "adjusting state when a prop changes" pattern — avoids an extra
  // commit for what is otherwise a same-render state adjustment.
  if (visible && openedFor !== visible) {
    setOpenedFor(visible);
    setIndex(initialIndex);
    setZoomed(false);
    currentIndex.set(initialIndex);
    pageX.set(-initialIndex * width);
    dismissY.set(0);
  } else if (!visible && openedFor !== visible) {
    setOpenedFor(visible);
  }

  const requestDismiss = (translationY: number, velocityY: number) => {
    if (translationY < 0) {
      // finger lifted / gesture cancelled below threshold — decide commit vs snap-back
      if (dismissY.value > DISMISS_THRESHOLD || velocityY > DISMISS_VELOCITY) {
        onClose();
      } else {
        dismissY.set(withTiming(0, { duration: 200 }));
      }
      return;
    }
    dismissY.set(translationY);
  };

  const pagePan = useMemo(() => Gesture.Pan()
    .enabled(!zoomed)
    .onUpdate((event) => {
      "worklet";
      if (axis.value === null) {
        if (Math.abs(event.translationX) > 8 || Math.abs(event.translationY) > 8) {
          axis.set(Math.abs(event.translationX) > Math.abs(event.translationY) ? "x" : "y");
        }
      }
      if (axis.value === "y") {
        if (event.translationY > 0) dismissY.set(event.translationY);
        return;
      }
      const current = currentIndex.value;
      const atEdge = (current === 0 && event.translationX > 0) || (current === items.length - 1 && event.translationX < 0);
      pageX.set(-current * width + event.translationX / (atEdge ? EDGE_RESISTANCE : 1));
    })
    .onEnd((event) => {
      "worklet";
      if (axis.value === "y") {
        if (dismissY.value > DISMISS_THRESHOLD || event.velocityY > DISMISS_VELOCITY) {
          runOnJS(onClose)();
        } else {
          dismissY.set(withTiming(0, { duration: 200 }));
        }
        axis.set(null);
        return;
      }
      const current = currentIndex.value;
      const distance = event.translationX / width;
      let next = current;
      if (distance <= -COMMIT_RATIO || event.velocityX <= -COMMIT_VELOCITY) next = Math.min(items.length - 1, current + 1);
      else if (distance >= COMMIT_RATIO || event.velocityX >= COMMIT_VELOCITY) next = Math.max(0, current - 1);
      currentIndex.set(next);
      pageX.set(withTiming(-next * width, { duration: 300, easing: Easing.out(Easing.cubic) }));
      if (next !== current) runOnJS(setIndex)(next);
      axis.set(null);
    }), [axis, currentIndex, dismissY, items.length, onClose, pageX, width, zoomed]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pageX.value },
      { translateY: dismissY.value },
      { scale: interpolate(dismissY.value, [0, 300], [1, .88], "clamp") },
    ],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dismissY.value, [0, 260], [1, .25], "clamp"),
  }));

  if (!items.length) return null;

  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <Animated.View style={[styles.scrim, scrimStyle]} />
    <View style={styles.viewer} pointerEvents="box-none">
      <GestureDetector gesture={pagePan}>
        <Animated.View style={[styles.track, { width: width * items.length, height }, trackStyle]}>
          {items.map((item, slide) => <ViewerSlide
            key={`${item.uri}-${slide}`}
            item={item}
            width={width}
            height={height}
            active={slide === index}
            onRequestDismiss={requestDismiss}
            onZoomChange={setZoomed}
          />)}
        </Animated.View>
      </GestureDetector>
      <View style={styles.close}><IconButton icon="x" label={`Close ${labelPrefix}`} onPress={onClose} /></View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000" },
  viewer: { flex: 1, justifyContent: "center" },
  track: { flexDirection: "row" },
  close: { position: "absolute", top: 52, right: 18, zIndex: 2 },
});

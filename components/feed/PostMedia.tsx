import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { MediaViewer, Text } from "@/components/core";
import { useFeedSwipeGesture } from "@/components/feed/FeedSwipeGesture";
import { useTheme } from "@/providers/ThemeProvider";

const VIDEO = /\.(mp4|mov|m4v|webm)(\?|$)/i;
const COMMIT_RATIO = .2;
const COMMIT_VELOCITY = 500;
const EDGE_RESISTANCE = 2.5;

function Video({ uri, width, height, controls = false }: { uri: string; width: number; height: number; controls?: boolean }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={{ width, height, backgroundColor: "#111" }} nativeControls={controls} contentFit={controls ? "contain" : "cover"} />;
}

function InlineCarousel({ urls, width, height, index, onIndexChange, onOpen, onFirstImageLoad }: { urls: string[]; width: number; height: number; index: number; onIndexChange: (index: number) => void; onOpen: (index: number) => void; onFirstImageLoad: (width: number, height: number) => void }) {
  const feedPan = useFeedSwipeGesture();
  const currentIndex = useSharedValue(index);
  const translateX = useSharedValue(-index * width);
  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  useEffect(() => {
    currentIndex.set(index);
    translateX.set(-index * width);
  }, [currentIndex, index, translateX, width]);
  const pan = useMemo(() => {
    const gesture = Gesture.Pan().activeOffsetX([-6, 6]).failOffsetY([-6, 6])
      .onUpdate(event => {
        "worklet";
        const current = currentIndex.value;
        const atEdge = (current === 0 && event.translationX > 0) || (current === urls.length - 1 && event.translationX < 0);
        translateX.set(-current * width + event.translationX / (atEdge ? EDGE_RESISTANCE : 1));
      })
      .onEnd(event => {
        "worklet";
        const current = currentIndex.value;
        const distance = event.translationX / width;
        let next = current;
        if (distance <= -COMMIT_RATIO || event.velocityX <= -COMMIT_VELOCITY) next = Math.min(urls.length - 1, current + 1);
        else if (distance >= COMMIT_RATIO || event.velocityX >= COMMIT_VELOCITY) next = Math.max(0, current - 1);
        currentIndex.set(next);
        translateX.set(withTiming(-next * width, { duration: 300, easing: Easing.out(Easing.cubic) }));
        if (next !== current) runOnJS(onIndexChange)(next);
      });
    if (feedPan) gesture.blocksExternalGesture(feedPan);
    return gesture;
  }, [currentIndex, feedPan, onIndexChange, translateX, urls.length, width]);
  return <GestureDetector gesture={pan}><Animated.View style={{ width, height }}><Animated.View style={[styles.track, { width: width * urls.length, height }, trackStyle]}>{urls.map((uri, slide) => {
    const tap = Gesture.Tap().maxDeltaX(6).maxDeltaY(6).onEnd((_event, success) => {
      "worklet";
      if (success) runOnJS(onOpen)(slide);
    });
    return <GestureDetector key={`${uri}-${slide}`} gesture={tap}><Animated.View accessible accessibilityRole="imagebutton" accessibilityLabel={`Open post media ${slide + 1} of ${urls.length}`} style={{ width, height }}>{VIDEO.test(uri) ? <Video uri={uri} width={width} height={height} /> : <Image source={{ uri }} style={{ width, height }} contentFit="cover" transition={160} cachePolicy="memory-disk" onLoad={slide === 0 ? event => onFirstImageLoad(event.source.width, event.source.height) : undefined} />}</Animated.View></GestureDetector>;
  })}</Animated.View></Animated.View></GestureDetector>;
}

export function PostMedia({ urls, compact = false }: { urls: string[]; compact?: boolean }) {
  const [index, setIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [ratio, setRatio] = useState(1);
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const availableWidth = screenWidth - (compact ? 116 : 72);
  const frameWidth = availableWidth * .8;
  const frameHeight = frameWidth / ratio;
  if (!urls.length) return null;

  return <>
    <View style={[styles.frame, { width: frameWidth, height: frameHeight, backgroundColor: colors.background, borderColor: colors.border }]}>
      {urls.length > 1 ? <InlineCarousel urls={urls} width={frameWidth} height={frameHeight} index={index} onIndexChange={setIndex} onOpen={setViewerIndex} onFirstImageLoad={(imageWidth, imageHeight) => { if (imageWidth && imageHeight) setRatio(Math.min(1.91, Math.max(.5, imageWidth / imageHeight))); }} /> : <Pressable onPress={() => setViewerIndex(0)} accessibilityRole="imagebutton" accessibilityLabel="Open post media" style={{ width: frameWidth, height: frameHeight }}>{VIDEO.test(urls[0]) ? <Video uri={urls[0]} width={frameWidth} height={frameHeight} /> : <Image source={{ uri: urls[0] }} style={{ width: frameWidth, height: frameHeight }} contentFit="contain" transition={160} cachePolicy="memory-disk" onLoad={event => { if (event.source.width && event.source.height) setRatio(event.source.width / event.source.height); }} />}</Pressable>}
      {urls.length > 1 ? <><View pointerEvents="none" style={styles.dots}>{urls.map((_, dot) => <View key={dot} style={[styles.dot, dot === index ? styles.dotActive : null]} />)}</View><View pointerEvents="none" style={styles.counter}><Text style={styles.counterText}>{index + 1}/{urls.length}</Text></View></> : null}
    </View>
    <MediaViewer
      visible={viewerIndex !== null}
      items={urls.map(uri => ({ uri, type: VIDEO.test(uri) ? "video" : "image" }))}
      initialIndex={viewerIndex ?? 0}
      onClose={() => setViewerIndex(null)}
      labelPrefix="media"
    />
  </>;
}

const styles = StyleSheet.create({
  frame: { marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: "hidden" },
  track: { flexDirection: "row" },
  dots: { position: "absolute", bottom: 10, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "#0009", borderRadius: 99 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF80" },
  dotActive: { width: 16, backgroundColor: "#FFFFFF" },
  counter: { position: "absolute", top: 8, right: 8, backgroundColor: "#0009", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  counterText: { color: "#FFFFFF", fontSize: 12, lineHeight: 14, fontWeight: "600" },
});

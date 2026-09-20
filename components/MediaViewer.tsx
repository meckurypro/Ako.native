// File: components/MediaViewer.tsx
// Partial port of web's src/components/MediaViewer.tsx.
//
// FLAG — this is a v1, not the full port. Web's version also supports
// pinch-to-zoom, double-tap-to-zoom, panning while zoomed, and a
// drag-down-to-dismiss gesture layered on top of horizontal paging —
// all hand-rolled from raw touch events with careful axis-lock
// arbitration between the three gestures. Reproducing that on native
// needs real multi-touch/pan gesture tracking (react-native-
// gesture-handler + likely reanimated for the transforms), neither of
// which is a project dependency yet. Rather than block the whole
// viewer on that, this ships the part that doesn't need them — full-
// screen paging between slides plus a close button — and leaves zoom/
// pan/dismiss-by-drag as a follow-up once that dependency question is
// settled.
//
// Web's Portal (renders to document.body) has no native equivalent
// need — RN's Modal already renders above everything else in its own
// native layer.
//
// Video playback isn't wired up here either — see PostMedia.tsx's
// VideoPlaceholder note; same placeholder is reused here full-screen.
import { useEffect, useRef } from "react";
import {
  BackHandler,
  Image as RNImage,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { X } from "lucide-react-native";
import { isVideoUrl } from "../hooks/useUploadPostMedia";
import { withAlpha } from "../lib/theme";

interface MediaViewerProps {
  mediaUrls: string[];
  startIndex: number;
  onClose: () => void;
}

// bg-black/text-white below are intentional, not a missed theme token
// — photo/video-viewer chrome stays a fixed black scrim regardless of
// the app's light/dark theme, same reasoning as web.
export function MediaViewer({ mediaUrls, startIndex, onClose }: MediaViewerProps) {
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(startIndex);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  function handleMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    indexRef.current = Math.max(
      0,
      Math.min(mediaUrls.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))
    );
  }

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.scrim}>
        {mediaUrls.length > 1 && (
          <View style={styles.counterWrap} pointerEvents="none">
            <Text style={styles.counterText}>
              {startIndex + 1} / {mediaUrls.length}
            </Text>
          </View>
        )}

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
          contentOffset={{ x: startIndex * width, y: 0 }}
        >
          {mediaUrls.map((url, i) => (
            <View key={i} style={{ width, height }}>
              {isVideoUrl(url) ? (
                <View style={[styles.fill, styles.videoPlaceholder]}>
                  <Text style={styles.videoPlaceholderText}>▶</Text>
                </View>
              ) : (
                <RNImage source={{ uri: url }} style={styles.fill} resizeMode="contain" />
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.closeBar} pointerEvents="box-none">
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Close" accessibilityRole="button">
            <X size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "#000000" },
  fill: { width: "100%", height: "100%" },
  videoPlaceholder: { alignItems: "center", justifyContent: "center" },
  videoPlaceholderText: { color: "#FFFFFF", fontSize: 48 },
  counterWrap: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  counterText: { color: withAlpha("#FFFFFF", 0.8), fontSize: 14 },
  closeBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 24,
    paddingTop: 40,
  },
  closeButton: {
    backgroundColor: withAlpha("#FFFFFF", 0.15),
    borderRadius: 999,
    padding: 12,
  },
});

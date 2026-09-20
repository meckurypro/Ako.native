// File: components/RepostBadge.tsx
// Port of web's src/components/RepostBadge.tsx.
//
// Sits in the card's top-right corner on a plain reshare (no caption) —
// the spot the old ⋯ menu used to occupy on this card. Subtle by
// design: a repost reads visually identical to the original post it's
// reposting, this badge is the only tell. Tapping jumps to the original
// post itself (its own PostCard, own engagement) — with `?view=post` so
// PostDetail skips auto-opening its comment sheet, since the point of
// this tap is "show me the original post", not "take me to its
// comments". If the original has been deleted/archived since the
// reshare was made, shows a message instead of navigating.
//
// Web stops propagation so the tap doesn't also trigger PostCard's own
// "open post" tap-through. RN's touch responder system already resolves
// nested pressables to whichever one is deepest/claims the touch first,
// so no explicit stopPropagation equivalent is needed here — PostCard's
// own Pressable simply won't also fire for a tap that landed on this one.
//
// PostDetail (`/post/[id]`) isn't ported yet — this pushes to the same
// route web uses; wire-up is verified once that screen exists.
import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Repeat2 } from "lucide-react-native";
import type { RepostSource } from "../types/database";
import { useTheme } from "../lib/theme";

export function RepostBadge({ source }: { source: RepostSource | null | undefined }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [unavailable, setUnavailable] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  function handlePress() {
    if (!source || source.is_deleted || source.is_archived) {
      setUnavailable(true);
      opacity.setValue(1);
      const timer = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
          setUnavailable(false)
        );
      }, 2500);
      return () => clearTimeout(timer);
    }
    router.push({ pathname: "/post/[id]" as any, params: { id: source.id, view: "post" } });
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Reshared — view original"
        style={styles.button}
      >
        <Repeat2 size={18} color={colors.accent} />
      </Pressable>

      {unavailable && (
        <Animated.View
          style={[styles.tooltip, { backgroundColor: colors.ink, opacity }]}
          pointerEvents="none"
        >
          <Text style={[styles.tooltipText, { color: colors.canvas }]}>
            This post is no longer available
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  button: { alignItems: "center", gap: 2 },
  // web: absolute top-full right-0 mt-1 whitespace-nowrap px-3 py-1.5
  // rounded-lg shadow-lg z-10
  tooltip: {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  tooltipText: { fontSize: 12, fontWeight: "500" },
});

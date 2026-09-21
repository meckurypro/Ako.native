// File: components/RepostEmbed.tsx
//
// The original post, embedded as its own bordered card inside a quote post.
// Tapping navigates to the original's own page (a normal push, so back returns
// to the quote). `source` is null/undefined when the original can no longer be
// fetched at all; is_deleted / is_archived on a fetched row is the expected
// path for "no longer available".
//
// Native: a single image is a fixed 128dp thumbnail (web h-32); multiple images
// reuse PostMedia's SlideCarousel at the same fixed height. The carousel's
// slide taps navigate to the original too (web let the tap bubble up to the
// surrounding <Link>; a native Pressable inside a Pressable swallows it, so the
// navigation is wired explicitly). Route /post/:id isn't ported yet.
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "./Avatar";
import { SlideCarousel } from "./PostMedia";
import { useTheme, withAlpha } from "../lib/theme";
import type { RepostSource } from "../types/database";

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RepostEmbed({ source }: { source: RepostSource | null | undefined }) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  // web: bg-surface dark:bg-[#121114]
  const cardBg = isDark ? "#121114" : colors.surface;

  if (!source || source.is_deleted || source.is_archived) {
    return (
      <View style={[styles.unavailable, { borderColor: colors.border, backgroundColor: cardBg }]}>
        <Text style={[styles.unavailableText, { color: colors.inkMuted }]}>
          {source?.is_archived && !source.is_deleted
            ? "This post has been archived by its author."
            : "This post is no longer available."}
        </Text>
      </View>
    );
  }

  const openOriginal = () => router.push(`/post/${source.id}` as any);
  const preview = source.content.length > 240 ? `${source.content.slice(0, 240)}…` : source.content;

  return (
    <Pressable
      onPress={openOriginal}
      accessibilityRole="link"
      style={({ pressed }) => [
        styles.card,
        { borderColor: colors.border, backgroundColor: pressed ? withAlpha(colors.canvas, isDark ? 0.2 : 0.5) : cardBg },
      ]}
    >
      <View style={styles.byline}>
        <Avatar src={source.author.avatar_url} name={source.author.display_name} size="sm" />
        <Text numberOfLines={1} style={[styles.username, { color: colors.ink }]}>
          {`@${source.author.username}`}
        </Text>
        <Text style={[styles.time, { color: colors.inkMuted }]}>{timeAgo(source.created_at)}</Text>
      </View>

      {!!source.heading && <Text style={[styles.heading, { color: colors.ink }]}>{source.heading}</Text>}
      {!!preview && <Text style={[styles.preview, { color: colors.ink }]}>{preview}</Text>}

      {source.media_urls.length === 1 && (
        <View style={[styles.thumb, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Image source={{ uri: source.media_urls[0] }} style={styles.thumbImage} resizeMode="cover" />
        </View>
      )}

      {source.media_urls.length > 1 && (
        <View style={styles.carouselWrap}>
          <SlideCarousel mediaUrls={source.media_urls} onTap={openOriginal} fixedHeight={128} />
        </View>
      )}
    </Pressable>
  );
}

// web: mt-3 block rounded-xl border px-3.5 py-3
const styles = StyleSheet.create({
  card: { marginTop: 12, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  byline: { flexDirection: "row", alignItems: "center", gap: 8 },
  username: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  time: { fontSize: 12, flexShrink: 0 },
  heading: { fontSize: 14, fontWeight: "600", marginTop: 6 },
  preview: { fontSize: 14, marginTop: 4 },
  thumb: { marginTop: 8, width: "100%", height: 128, borderRadius: 8, overflow: "hidden", borderWidth: 1 },
  thumbImage: { width: "100%", height: "100%" },
  carouselWrap: { marginTop: 8 },
  // web: mt-3 rounded-xl border px-4 py-3 text-sm
  unavailable: { marginTop: 12, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  unavailableText: { fontSize: 14 },
});

// File: components/TaggedProjectEmbed.tsx
//
// Subtle project tag at the bottom of a post: a small square thumbnail and the
// title, on a soft glass layer of the card's own surface — deliberately the
// smallest of the embed patterns (RepostEmbed is a post-within-a-post; this
// reads as a mention). Price is intentionally never rendered here; it only
// shows once the viewer opens the project itself.
//
// `project` is null when it can no longer be fetched (the id lingers on the
// post row after the project was deleted). A non-null project whose status is
// not "active" (draft, archived) doesn't link out to something the viewer can't
// see.
//
// Native: web's translucency + backdrop blur + inset highlight is approximated
// with a 60% surface fill, a 10% white hairline and a soft shadow (RN has no
// backdrop-filter or inset shadow). Routes /projects/:id (and the flat /:slug)
// aren't ported yet.
//
// ProjectType is copied from web's useProjects.ts (the projects hooks aren't
// ported yet) — replace with the import when they are.
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ImageIcon } from "lucide-react-native";
import { getProjectPath } from "../lib/projectLinks";
import { useTheme, withAlpha } from "../lib/theme";

export type ProjectType =
  | "event"
  | "media"
  | "file"
  | "url"
  | "course"
  | "room"
  | "meeting"
  | "gig"
  | "pitch"
  | "book";

export interface TaggedProjectSummary {
  id: string;
  title: string;
  thumbnail_url: string | null;
  project_type: ProjectType;
  price_usd: number;
  promo_price_usd: number | null;
  status: "active" | "draft" | "archived" | "cancelled";
  slug?: string | null;
  posted_as_page?: { username: string } | null;
  owner: {
    username: string;
    display_name: string;
  };
}

export function TaggedProjectEmbed({ project }: { project: TaggedProjectSummary | null | undefined }) {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  if (!project) return null;

  if (project.status !== "active") {
    return (
      <View
        style={[
          styles.unavailable,
          { borderColor: withAlpha(colors.border, 0.6), backgroundColor: withAlpha(colors.surface, 0.7) },
        ]}
      >
        <Text style={[styles.unavailableText, { color: colors.inkMuted }]}>
          This tagged project is no longer available.
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => router.push(getProjectPath(project) as any)}
      accessibilityRole="link"
      accessibilityLabel={project.title}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: "rgba(255,255,255,0.10)",
          backgroundColor: withAlpha(colors.surface, pressed ? 0.8 : 0.6),
          shadowColor: isDark ? "#000000" : "#1F1D1A",
          shadowOpacity: isDark ? 0.24 : 0.06,
        },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: withAlpha(colors.surface, 0.8), borderColor: withAlpha(colors.border, 0.5) }]}>
        {project.thumbnail_url ? (
          <Image source={{ uri: project.thumbnail_url }} style={styles.thumbImage} resizeMode="cover" />
        ) : (
          <ImageIcon size={16} color={colors.inkMuted} />
        )}
      </View>
      <View style={styles.titleWrap}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.ink }]}>
          {project.title}
        </Text>
      </View>
    </Pressable>
  );
}

// web (card): mt-3 flex items-center gap-2.5 rounded-xl border px-2.5 py-2;
// thumb: w-11 h-11 rounded-lg border; title: text-sm font-medium truncate.
const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  thumbImage: { width: "100%", height: "100%" },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "500" },
  // web: mt-3 rounded-xl border px-3.5 py-2.5 text-sm
  unavailable: { marginTop: 12, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  unavailableText: { fontSize: 14 },
});

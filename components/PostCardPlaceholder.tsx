// File: components/PostCardPlaceholder.tsx
//
// TEMPORARY stand-in for web's PostCard so the Feed can render real posts
// end to end while the real card is ported in slices. Shows byline, heading
// and text only — no media, reactions, sheets or menus. Same props the real
// PostCard takes (`post`, `active`), so Feed doesn't change when this is
// replaced. Delete this file when components/PostCard.tsx lands.
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "./Avatar";
import { useTheme } from "../lib/theme";
import { isPlainReshare, type PostWithAuthor } from "../types/database";

interface PostCardPlaceholderProps {
  post: PostWithAuthor;
  // Real PostCard defers its per-card queries until its tab has been
  // visited; nothing to defer here.
  active?: boolean;
}

export function PostCardPlaceholder({ post }: PostCardPlaceholderProps) {
  const { colors } = useTheme();

  // A plain reshare renders as the original; a quote shows its own text.
  const shown = isPlainReshare(post) && post.reshared_post ? post.reshared_post : post;
  const page = shown === post ? post.posted_as_page : null;
  const name = page?.name ?? shown.author.display_name;
  const handle = page?.username ?? shown.author.username;
  const avatar = page?.avatar_url ?? shown.author.avatar_url;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.byline}>
        <Avatar src={avatar} name={name} size="md" />
        <View style={styles.bylineText}>
          <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.handle, { color: colors.inkMuted }]} numberOfLines={1}>
            @{handle}
          </Text>
        </View>
      </View>
      {!!shown.heading && <Text style={[styles.heading, { color: colors.ink }]}>{shown.heading}</Text>}
      {!!shown.content && <Text style={[styles.content, { color: colors.ink }]}>{shown.content}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12, gap: 10 },
  byline: { flexDirection: "row", alignItems: "center", gap: 10 },
  bylineText: { flex: 1 },
  name: { fontSize: 14, fontWeight: "600" },
  handle: { fontSize: 12 },
  heading: { fontSize: 16, fontWeight: "600" },
  content: { fontSize: 15, lineHeight: 22 },
});

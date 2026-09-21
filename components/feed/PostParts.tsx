// File: components/feed/PostParts.tsx
//
// Small pieces of web's PostCard that the native card was missing, kept here
// so PostCard.tsx itself only gains a few call sites:
//   - PostCollaboratorsBadge — avatar-corner badge; tap lists everyone credited
//   - RepostBadgeButton      — reshare badge on the header divider: tap opens
//                              the original, or explains it's gone
//   - TaggedProjectEmbed     — subtle project tag under a post
//   - UnavailableEmbed       — quote card whose original is deleted/archived
//   - ArchivedCornerBar      — Restore / Delete on frozen (archived / dead
//                              reshare) cards, whose tray is disabled
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Linking, Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Icon } from "@/components/core/Icon";
import { useRouter } from "expo-router";
import { Avatar, PressableScale, Text } from "@/components/core";
import { useCollaborators } from "@/features/feed/postExtras";
import type { Post, TaggedProjectSummary } from "@/features/feed/types";
import { useTheme } from "@/providers/ThemeProvider";
import { fonts } from "@/theme/fonts";

// ─── Collaborators badge ───────────────────────────────────────────────────
// Only ACCEPTED collaborators count (an outstanding invite isn't "posted with"
// anyone yet), so this renders nothing until one has accepted. web: a fixed
// w-56 dropdown under the badge, "Posted with" caption, rows link to profiles.
const POPOVER_WIDTH = 224;

export function PostCollaboratorsBadge({ postId }: { postId: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { data } = useCollaborators(postId);
  const anchor = useRef<View>(null);
  const [rect, setRect] = useState<{ x: number; y: number; h: number } | null>(null);
  const accepted = (data ?? []).filter((c) => c.status === "accepted");

  if (accepted.length === 0) return null;

  const label = `Posted with ${accepted.length} ${accepted.length === 1 ? "collaborator" : "collaborators"}`;
  const left = rect ? Math.min(Math.max(8, rect.x - 8), windowWidth - POPOVER_WIDTH - 8) : 0;

  return (
    <>
      <Pressable
        ref={anchor}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        onPress={() => anchor.current?.measureInWindow((x, y, _w, h) => setRect({ x, y, h }))}
        style={[s.collabBadge, { backgroundColor: colors.accent, borderColor: colors.surface }]}
      >
        <Icon name="users" size={11} color={colors.background} />
      </Pressable>

      {rect && (
        <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={() => setRect(null)}>
          <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={() => setRect(null)} />
          <View
            style={[
              s.popover,
              { top: rect.y + rect.h + 6, left, width: POPOVER_WIDTH, backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Text color="secondary" style={s.popoverCaption}>
              POSTED WITH
            </Text>
            {accepted.map((c) => (
              <Pressable
                key={c.user.id}
                accessibilityRole="link"
                onPress={() => {
                  setRect(null);
                  router.push({ pathname: "/profiles/[username]", params: { username: c.user.username } });
                }}
                style={({ pressed }) => [s.popoverRow, pressed && { backgroundColor: colors.surface }]}
              >
                <Avatar uri={c.user.avatar_url} name={c.user.display_name} size={32} />
                <Text numberOfLines={1} style={s.popoverName}>
                  {c.user.display_name}
                </Text>
              </Pressable>
            ))}
          </View>
        </Modal>
      )}
    </>
  );
}

// ─── Reshare badge ─────────────────────────────────────────────────────────
// Sits in the header divider on a plain reshare — the only tell that a card is
// a repost. Tapping jumps to the original post; if the original was deleted or
// archived since, shows a short message instead of navigating. (The filled
// accent-soft circle is native's existing tap-target treatment, kept as is.)
export function RepostBadgeButton({ source }: { source: Post["reshared_post"] | undefined }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [unavailable, setUnavailable] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const press = () => {
    if (!source || source.is_deleted || source.is_archived) {
      setUnavailable(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setUnavailable(false), 2500);
      return;
    }
    router.push({ pathname: "/posts/[postId]", params: { postId: source.id } });
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reshared — view original"
        hitSlop={8}
        onPress={press}
        style={[s.repostBadge, { backgroundColor: colors.accentSoft }]}
      >
        <Icon name="repeat-2" size={14} color={colors.accent} />
      </Pressable>
      {unavailable && (
        <View style={[s.tooltip, { backgroundColor: colors.text }]}>
          <Text style={[s.tooltipText, { color: colors.background }]}>This post is no longer available</Text>
        </View>
      )}
    </View>
  );
}

// ─── Tagged project ────────────────────────────────────────────────────────
// A small square thumbnail and the title on a soft glass layer of the card's
// own surface — deliberately the quietest embed (a mention, not a
// post-within-a-post). Price is never shown here. Native has no project detail
// screen yet, so a tap opens the project on the web app.
const WEB_ORIGIN = "https://ako.app";

export function TaggedProjectEmbed({ project }: { project: TaggedProjectSummary | null | undefined }) {
  const { colors, isDark } = useTheme();
  if (!project) return null;

  if (project.status !== "active") {
    return (
      <View style={[s.embed, s.embedNotice, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text color="secondary" style={s.noticeText}>
          This tagged project is no longer available.
        </Text>
      </View>
    );
  }

  const url = project.slug ? `${WEB_ORIGIN}/${project.slug}` : `${WEB_ORIGIN}/projects/${project.id}`;
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={project.title}
      onPress={() => void Linking.openURL(url)}
      style={[
        s.embed,
        s.projectCard,
        {
          borderColor: "rgba(255,255,255,0.10)",
          backgroundColor: isDark ? "rgba(19,19,17,0.6)" : "rgba(253,251,246,0.6)",
        },
      ]}
    >
      <View style={[s.thumb, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        {project.thumbnail_url ? (
          <Image source={{ uri: project.thumbnail_url }} style={s.thumbImage} contentFit="cover" />
        ) : (
          <Icon name="image" size={16} color={colors.textSecondary} />
        )}
      </View>
      <Text numberOfLines={1} style={s.projectTitle}>
        {project.title}
      </Text>
    </PressableScale>
  );
}

// ─── Unavailable quote embed ───────────────────────────────────────────────
export function UnavailableEmbed({ source }: { source: Post["reshared_post"] | undefined }) {
  const { colors } = useTheme();
  const archived = !!source && source.is_archived && !source.is_deleted;
  return (
    <View style={[s.embed, s.embedNotice, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text color="secondary" style={s.noticeText}>
        {archived ? "This post has been archived by its author." : "This post is no longer available."}
      </Text>
    </View>
  );
}

// ─── Restore / Delete corner bar ───────────────────────────────────────────
function CornerButton({ label, icon, background, onPress }: { label: string; icon: ReactNode; background: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[s.cornerButton, { backgroundColor: background }]}
    >
      {icon}
      <Text style={[s.cornerText, { color: colors.background }]}>{label}</Text>
    </Pressable>
  );
}

export function ArchivedCornerBar({ onRestore, onDelete }: { onRestore?: () => void; onDelete: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={s.cornerBar}>
      {onRestore && (
        <CornerButton
          label="Restore"
          background={`${colors.text}B3`}
          icon={<Icon name="rotate-ccw" size={14} color={colors.background} />}
          onPress={onRestore}
        />
      )}
      <CornerButton
        label="Delete"
        background={`${colors.danger}D9`}
        icon={<Icon name="trash-2" size={14} color={colors.background} />}
        onPress={onDelete}
      />
    </View>
  );
}

const s = StyleSheet.create({
  // web: absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent border-2 border-surface
  collabBadge: { position: "absolute", right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  // web: w-56 bg-canvas border rounded-xl shadow-lg py-2
  popover: { position: "absolute", borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 8, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  popoverCaption: { fontSize: 12, lineHeight: 16, fontFamily: fonts.body.semibold, letterSpacing: 0.6, paddingHorizontal: 12, paddingBottom: 6 },
  popoverRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  popoverName: { flex: 1, fontSize: 14, lineHeight: 19 },

  repostBadge: { padding: 5, borderRadius: 99 },
  // web: absolute top-full right-0 mt-1 bg-ink text-canvas text-xs px-3 py-1.5 rounded-lg shadow-lg
  tooltip: { position: "absolute", top: "100%", right: 0, marginTop: 4, width: 214, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, zIndex: 10, elevation: 6 },
  tooltipText: { fontSize: 12, lineHeight: 16 },

  embed: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  embedNotice: { paddingHorizontal: 16, paddingVertical: 12 },
  noticeText: { fontSize: 14, lineHeight: 20 },
  // web: flex items-center gap-2.5 rounded-xl border px-2.5 py-2
  projectCard: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 8 },
  thumb: { width: 44, height: 44, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  thumbImage: { width: "100%", height: "100%" },
  projectTitle: { flex: 1, fontSize: 14, lineHeight: 19, fontFamily: fonts.body.medium },

  // web: absolute top-3 right-3 z-10 flex gap-2; button rounded-full px-3 py-1.5 text-xs font-medium
  cornerBar: { position: "absolute", top: 12, right: 12, zIndex: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  cornerButton: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  cornerText: { fontSize: 12, lineHeight: 16, fontFamily: fonts.body.medium },
});

// File: components/PostCard.tsx
//
// Port of web's src/components/PostCard.tsx (988 lines), built on the pieces
// already in the app: PostMedia, FollowButton, ReactionTray/ReactionMoreSheet,
// the reaction / bookmark / engagement-order / collaborator hooks, and the
// Modal/ConfirmDialog/BottomSheet overlays.
//
// Ported: card chrome; byline (avatar + collaborators badge, name, verified/
// tier badges, role tags or page tagline, time ago, globe, watermark);
// header/body divider with the reshare badge and Follow pill; body for normal
// posts, quote captions and plain reshares; media; quote embed; tagged-project
// embed; the stats line (`showStats`); the engagement tray — Like pinned left,
// three ranked middle actions, "···" pinned right — and the long-press/"···"
// sheet; Dislike, Save, Share; owner management (Prioritize, Edit, Promote,
// Archive/Unarchive, Delete with confirms); the archived-post Restore/Delete
// bar; double-tap-to-like; profile-visit recording.
//
// Not yet — each is stubbed `TODO(port)`:
//   - Support / Disagree / Pushback (StanceComposer), Gift (GiftPicker) and
//     Reshare (ReshareSheet + useCreateReshare). Until they land they're kept
//     out of the ranked tray/sheet entirely (PORTED_SECONDARY below) rather
//     than rendered as dead buttons — add each key to that list when its sheet
//     exists and the rest of the wiring here is already in place.
//   - CommentSheet behind "Comments: N".
//   - Owner "Tag people" (TagPeopleSheet) and "Collaborators" (CollaboratorsSheet).
//   - MusicAttribution (needs audio playback).
//   - Page-mode (burnt-orange) theme; Roboto for the name/heading.
//
// Native notes:
//   - Routes /profile/:username, /page/:username, /post/:id (+ /edit),
//     /promote/:id aren't ported yet; they're pushed with `as any` the same way
//     TopHeader pushes /create.
//   - Share uses the OS share sheet with lib/webUrl.ts's post URL; like web, a
//     share is recorded (a "share" reaction, which also feeds the usage ranking)
//     only if the person actually completed it.
//   - Like sound/haptic: the hook's `play` is silent for now (see useSound).
import { useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useRouter } from "expo-router";
import {
  Archive,
  Bookmark,
  Globe,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Redo2,
  RotateCcw,
  Rocket,
  ThumbsDown,
  Trash2,
} from "lucide-react-native";
import { Avatar } from "./Avatar";
import { LikeHeart } from "./LikeHeart";
import { TierBadge } from "./TierBadge";
import { VerifiedBadge } from "./VerifiedBadge";
import { RoleTags } from "./RoleTags";
import { FollowButton } from "./FollowButton";
import { ReactionTray, type EngagementAction } from "./ReactionTray";
import { ReactionMoreSheet } from "./ReactionMoreSheet";
import { PostMedia } from "./PostMedia";
import { PostContent } from "./PostContent";
import { AkoWatermark } from "./AkoWatermark";
import { RepostEmbed } from "./RepostEmbed";
import { RepostBadge } from "./RepostBadge";
import { TaggedProjectEmbed, type TaggedProjectSummary } from "./TaggedProjectEmbed";
import { PostCollaboratorsBadge } from "./PostCollaboratorsBadge";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { useAuth } from "../hooks/useAuth";
import { useIsBookmarked, useToggleBookmark } from "../hooks/useBookmarks";
import { useMyReaction, useToggleReaction } from "../hooks/useReactions";
import { recordProfileVisitFromPost } from "../hooks/useProfileVisits";
import { useEngagementOrder, type SecondaryActionKey } from "../hooks/useEngagementOrder";
import { useCollaborators } from "../hooks/useCollaboration";
import {
  useDeletePost,
  useSetPostArchived,
  usePostViewCount,
  usePrioritizedPostToday,
  usePrioritizePost,
  canEditPost,
} from "../hooks/usePosts";
import { formatPostTime, formatPostDate, formatCompactCount } from "../lib/formatStats";
import { getPostShareUrl } from "../lib/webUrl";
import { useTheme, withAlpha } from "../lib/theme";
import { isPlainReshare, isQuote, type PostWithAuthor } from "../types/database";

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

const DOUBLE_TAP_WINDOW_MS = 300;

// web: dark:bg-[#121114] on the card (its own value, not the --color-surface token).
const CARD_DARK = "#121114";

// Secondary actions whose UI is ported. See the header note — add "support",
// "disagree", "pushback", "gift", "reshare" here as their sheets land.
const PORTED_SECONDARY: SecondaryActionKey[] = ["dislike", "save", "share"];

const DEFAULT_ORDER: SecondaryActionKey[] = [
  "support",
  "reshare",
  "share",
  "gift",
  "save",
  "disagree",
  "pushback",
  "dislike",
];

// Own-post view: engagement that makes no sense directed at yourself is hidden
// entirely rather than disabled.
const HIDDEN_FOR_OWNER: SecondaryActionKey[] = ["disagree", "pushback", "gift", "dislike"];

interface ActionDef {
  key: SecondaryActionKey;
  label: string;
  icon: ReactNode;
  count: number | null;
  onAction: () => void;
}

export function PostCard({
  post,
  isOwnerView = false,
  showStats = false,
  active = true,
  onRequestOpenComments,
}: {
  post: PostWithAuthor;
  // Accepted so callers like ProfilePage can flag the viewer as the post's
  // owner (e.g. viewing their own profile while impersonating no one).
  isOwnerView?: boolean;
  // Only PostDetail (the "expanded", comments-visible view) passes this —
  // shows the time · date · views line above the tray. Feed cards leave it off.
  showStats?: boolean;
  // False defers this card's per-card queries until it's true. Only Feed passes
  // false — for cards in a tab the visitor hasn't swiped to yet, since
  // SwipeableTabs mounts all three feed tabs' cards at once.
  active?: boolean;
  // Only PostDetail passes this — called instead of opening the card's own
  // comment sheet when showStats is true (PostDetail owns the sheet there).
  onRequestOpenComments?: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { colors, isDark } = useTheme();
  const lastTapRef = useRef(0);
  const [dividerBadgeHeight, setDividerBadgeHeight] = useState(0);

  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showPrioritizeConfirm, setShowPrioritizeConfirm] = useState(false);
  const [prioritizeError, setPrioritizeError] = useState<string | null>(null);

  // An outstanding invite isn't a real collaboration yet — only accepted
  // collaborators lock editing (the other person is credited on this content).
  const { data: collaborators } = useCollaborators("post", post.id);
  const hasAcceptedCollaborators = (collaborators ?? []).some((c) => c.status === "accepted");

  // Reshare/quote: reshared_post_id set + empty content = plain reshare (own
  // card, own engagement — attributed to the resharer, the original shown
  // inline). Non-empty content = quote (own post, original embedded below the
  // caption). Both render/engage as `post` itself (never swapped to the
  // original) — the person who reshared owns this card.
  const plainReshare = isPlainReshare(post);
  const quotePost = isQuote(post);
  const original = post.reshared_post;
  const originalGone = !original || original.is_deleted || original.is_archived;

  // Tagged project (item 10) — joined on by FEED_SELECT, not on the Post type.
  const taggedProject = (post as any).tagged_project as TaggedProjectSummary | null | undefined;

  const isOwner = isOwnerView || user?.id === post.author.id;

  // Archived content's engagement is frozen — only ever true for the owner
  // viewing their own archived post from the Archive screen.
  const isArchivedFrozen = isOwner && post.is_archived;

  // A plain reshare whose original is gone has nothing left to engage with —
  // frozen the same way an archived post is; existing counts stay, new
  // engagement is blocked.
  const reshareContentGone = plainReshare && originalGone;
  const trayFrozen = isArchivedFrozen || reshareContentGone;

  // Page-mode post: byline shows the organisation/brand instead of the human
  // who tapped post. author_id / isOwner stay keyed on the real person
  // (accountability, edit/delete rights) — only the *display* identity swaps.
  const postedAsPage = post.posted_as_page ?? null;
  const identityName = postedAsPage ? postedAsPage.name : post.author.display_name;
  const identityAvatar = postedAsPage ? postedAsPage.avatar_url : post.author.avatar_url;

  const isBookmarkedQuery = useIsBookmarked(post.id, active);
  const toggleBookmark = useToggleBookmark(post.id);
  const isBookmarked = !!isBookmarkedQuery.data;

  const likeQuery = useMyReaction(post.id, "post", "like", active);
  const dislikeQuery = useMyReaction(post.id, "post", "dislike", active);
  const toggleLike = useToggleReaction(post.id, "post", "like");
  const toggleDislike = useToggleReaction(post.id, "post", "dislike");
  const toggleShare = useToggleReaction(post.id, "post", "share");
  const isLiked = !!likeQuery.data;
  const isDisliked = !!dislikeQuery.data;

  const deletePost = useDeletePost();
  const setArchived = useSetPostArchived();
  const prioritizePost = usePrioritizePost();
  // Only the owner ever needs today's pick — everyone else's view of
  // Prioritize plays out through the feed itself, not this button.
  const prioritizedTodayQuery = usePrioritizedPostToday(post.author.id, isOwner);
  const isPrioritizedToday = (prioritizedTodayQuery.data ?? null) === post.id;

  const { data: engagementOrder } = useEngagementOrder();

  const viewCountQuery = usePostViewCount(post.id, showStats);
  const viewCount = viewCountQuery.data ?? 0;

  function openIdentity() {
    if (postedAsPage) {
      router.push(`/page/${postedAsPage.username}` as any);
      return;
    }
    // Only a real profile destination (not a Page) gets the "came from this
    // post" marker — ProfilePage's fromFeedPost powers its "Back to post" FAB.
    if (user) recordProfileVisitFromPost(post.id, post.author.id, user.id);
    router.push({ pathname: `/profile/${post.author.username}`, params: { fromFeedPost: post.id } } as any);
  }

  function handleContentTap() {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_WINDOW_MS) {
      // Same pending-guard as the Like button itself — without it, a
      // double-tap right as a separate tap on the Like icon is still in
      // flight could fire on a stale `isLiked` read.
      if (!isLiked && !toggleLike.isPending) toggleLike.mutate(false);
    }
    lastTapRef.current = now;
  }

  // A tap on a #hashtag / @mention inside the body is consumed by that nested
  // link (see formatText), so this only runs for taps on plain text — the
  // native equivalent of web stepping aside when the tap started in an <a>.
  function handleContentPress() {
    handleContentTap();
    router.push(`/post/${post.id}` as any);
  }

  // Opens the immersive comment overlay in place. On PostDetail itself
  // (showStats) the page owns that sheet, so the tap is handed up instead.
  function handleCommentTap() {
    if (showStats) {
      onRequestOpenComments?.();
      return;
    }
    // TODO(port): setShowComments(true) → <CommentSheet …/> once it's ported.
  }

  async function handleShare() {
    const url = getPostShareUrl(post.id);
    try {
      const result = await Share.share(Platform.OS === "ios" ? { url } : { message: url });
      if (result.action !== Share.sharedAction) return; // dismissed
    } catch {
      return;
    }
    toggleShare.mutate(false); // still record the share
  }

  function handleEdit() {
    router.push(`/post/${post.id}/edit` as any);
  }

  // Archiving prompts for confirmation (non-danger ConfirmDialog); unarchiving
  // is its reversal, so it goes straight through.
  function handleToggleArchive() {
    if (post.is_archived) {
      setArchived.mutate({ postId: post.id, archived: false });
    } else {
      setShowArchiveConfirm(true);
    }
  }

  function handleConfirmArchive() {
    setShowArchiveConfirm(false);
    setArchived.mutate({ postId: post.id, archived: true });
  }

  function handleConfirmDelete() {
    setShowDeleteConfirm(false);
    deletePost.mutate(post.id, {
      onSuccess: () => toast("Post deleted.", { variant: "success" }),
    });
  }

  // Deliberately confirmed — prioritizing locks out the creator's other posts
  // from feeds today (until each viewer engages with this one), so it's a
  // "this is my one pick for today" decision, not a toggle.
  function handlePrioritizeTap() {
    if (isPrioritizedToday) return;
    setShowPrioritizeConfirm(true);
  }

  function handleConfirmPrioritize() {
    setShowPrioritizeConfirm(false);
    prioritizePost.mutate(post.id, {
      onError: (err) => {
        setPrioritizeError(err instanceof Error ? err.message : "Couldn't prioritize this post.");
      },
    });
  }

  // ─── Secondary action definitions ───────────────────────────────────────
  const ink = colors.ink;
  const secondaryDefs: Partial<Record<SecondaryActionKey, ActionDef>> = {
    dislike: {
      key: "dislike",
      label: isDisliked ? "Disliked" : "Dislike",
      icon: <ThumbsDown size={24} color={ink} fill={isDisliked ? ink : "none"} />,
      count: post.dislike_count > 0 ? post.dislike_count : null,
      onAction: () => toggleDislike.mutate(isDisliked),
    },
    save: {
      key: "save",
      label: isBookmarked ? "Saved" : "Save",
      icon: <Bookmark size={24} color={ink} fill={isBookmarked ? ink : "none"} />,
      count: null,
      onAction: () => toggleBookmark.mutate(isBookmarked),
    },
    // Unpinned from its old fixed right-side slot — only Like stays pinned,
    // everything else (Share included) is ranked by usage. handleShare records
    // a "share" reaction on completion, which is the signal this ranks against.
    share: {
      key: "share",
      label: "Share",
      icon: <Redo2 size={24} color={ink} />,
      count: null,
      onAction: () => void handleShare(),
    },
    // TODO(port): support / disagree / pushback (StanceComposer — icons carry
    // STANCE_COLORS), gift (GiftPicker; hidden for owners, page identities and
    // posts with a tagged project), reshare (ReshareSheet; hidden for owners
    // and once already reshared — needs useHasReshared, already in usePosts).
  };

  // Ranked order from the hook, falling back to the default until loaded.
  const order = (engagementOrder ?? DEFAULT_ORDER).filter(
    (k) => PORTED_SECONDARY.includes(k) && !(isOwner && HIDDEN_FOR_OWNER.includes(k))
  );

  // Edit eligibility is always about this row (the reshare/quote/normal post
  // belonging to the viewer). A plain reshare has no content of its own, so
  // there's nothing to edit; a post crediting an accepted collaborator is never
  // editable (it can still be deleted, just not silently rewritten).
  const canEdit = !plainReshare && !hasAcceptedCollaborators && canEditPost(post);

  // ─── Left (fixed): Like only ────────────────────────────────────────────
  const leftActions: EngagementAction[] = [
    {
      key: "like",
      label: isLiked ? "Liked" : "Like",
      icon: <LikeHeart active={isLiked} size={24} color={colors.danger} />,
      count: post.like_count > 0 ? post.like_count : null,
      // Guards against the optimistic-UI double-tap trap: this closes over
      // `isLiked` from render time, so two taps landing before the first
      // one's optimistic update paints would fire mutate(false) then
      // mutate(true) — "liked it and it instantly undid itself". Ignoring a
      // second tap while the first is in flight closes that window.
      onClick: () => {
        if (toggleLike.isPending) return;
        toggleLike.mutate(isLiked);
      },
    },
  ];

  // ─── Right (fixed): "···" opens the full sheet on a plain tap ───────────
  const rightActions: EngagementAction[] = [
    {
      key: "more",
      label: "More",
      icon: <MoreHorizontal size={24} color={ink} />,
      count: null,
      onClick: () => setShowMoreActions(true),
    },
  ];

  // ─── The sheet: every ported secondary action regardless of usage rank,
  // plus own-post management. Only the top 3 (by usage) get a permanent slot.
  const moreActions: EngagementAction[] = [
    ...order.map(
      (k): EngagementAction => ({
        key: secondaryDefs[k]!.key,
        label: secondaryDefs[k]!.label,
        icon: secondaryDefs[k]!.icon,
        count: secondaryDefs[k]!.count,
        onClick: () => secondaryDefs[k]!.onAction(),
      })
    ),
    ...(isOwner
      ? ([
          {
            key: "prioritize",
            label: isPrioritizedToday ? "Prioritized today" : "Prioritize",
            icon: (
              <Rocket
                size={24}
                color={isPrioritizedToday ? colors.accent : ink}
                fill={isPrioritizedToday ? colors.accent : "none"}
              />
            ),
            count: null,
            onClick: handlePrioritizeTap,
          },
          ...(canEdit
            ? [
                {
                  key: "edit",
                  label: "Edit",
                  icon: <Pencil size={24} color={ink} />,
                  count: null,
                  onClick: handleEdit,
                },
              ]
            : []),
          {
            key: "promote",
            label: "Promote",
            icon: <Megaphone size={24} color={ink} />,
            count: null,
            onClick: () => router.push(`/promote/${post.id}` as any),
          },
          // TODO(port): "Tag people" (TagPeopleSheet) and "Collaborators"
          // (CollaboratorsSheet), between Promote and Archive.
          {
            key: "archive",
            label: post.is_archived ? "Unarchive" : "Archive",
            icon: post.is_archived ? <RotateCcw size={24} color={ink} /> : <Archive size={24} color={ink} />,
            count: null,
            onClick: handleToggleArchive,
          },
          {
            key: "delete",
            label: "Delete",
            icon: <Trash2 size={24} color={ink} />,
            count: null,
            onClick: () => setShowDeleteConfirm(true),
          },
        ] satisfies EngagementAction[])
      : []),
  ];

  // ─── Middle (fixed, 3 slots): top 3 of the sheet's list. The row is 5 slots
  // in all — Like + 3 + "···"; long-pressing any icon opens the sheet too.
  const middleActions: EngagementAction[] = moreActions.slice(0, 3);

  const cardBackground = isDark ? CARD_DARK : colors.surface;
  const shadowInk = isDark ? "#000000" : "#1F1D1A";

  // What the body shows: a plain reshare shows the ORIGINAL's heading/content/
  // media inline as if it were the resharer's own post (the badge in the
  // header is the only "this is a repost" signal); everything else its own.
  const bodySource = plainReshare && !originalGone ? original! : post;
  const hasBody = bodySource.content.trim() !== "" || !!bodySource.heading;

  const showDividerBadges = plainReshare || (!isOwner && !postedAsPage);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBackground,
          borderColor: withAlpha(shadowInk, 0.07), // web: 0 0 0 1px rgba(ink, 0.07)
          shadowColor: shadowInk,
        },
      ]}
    >
      {/* Restore/Delete for archived content — pulled out of the sheet into
          their own always-usable icons, since the tray is frozen and the sheet
          is unreachable while it's archived. */}
      {isArchivedFrozen && (
        <View style={styles.cornerBar}>
          <CornerButton
            label="Restore"
            icon={<RotateCcw size={14} color={colors.canvas} />}
            background={withAlpha(colors.ink, 0.7)}
            color={colors.canvas}
            onPress={handleToggleArchive}
          />
          <CornerButton
            label="Delete"
            icon={<Trash2 size={14} color={colors.canvas} />}
            background={withAlpha(colors.danger, 0.85)}
            color={colors.canvas}
            onPress={() => setShowDeleteConfirm(true)}
          />
        </View>
      )}

      {/* Same idea, narrower case: a plain reshare whose original is gone has a
          frozen tray and no sheet — this is the owner's only way to clear it
          out. Not shown when the archived bar above already rendered one. */}
      {reshareContentGone && isOwner && !isArchivedFrozen && (
        <View style={styles.cornerBar}>
          <CornerButton
            label="Delete"
            icon={<Trash2 size={14} color={colors.canvas} />}
            background={withAlpha(colors.danger, 0.85)}
            color={colors.canvas}
            onPress={() => setShowDeleteConfirm(true)}
          />
        </View>
      )}

      <View>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={openIdentity} accessibilityRole="link" accessibilityLabel={identityName}>
            <Avatar src={identityAvatar} name={identityName} size="md" />
            <PostCollaboratorsBadge target="post" targetId={post.id} />
          </Pressable>

          <View style={styles.headerText}>
            {/* Name row — own line, never wraps. The Akọ watermark is a sibling
                of this row only, so it lands flush at this row's true right
                edge without narrowing the rows below it. */}
            <View style={styles.nameRow}>
              <View style={styles.nameAndBadges}>
                <Pressable onPress={openIdentity} style={styles.nameLink}>
                  <Text numberOfLines={1} style={[styles.name, { color: colors.ink }]}>
                    {identityName}
                  </Text>
                </Pressable>
                {postedAsPage ? (
                  postedAsPage.is_verified && <VerifiedBadge />
                ) : (
                  <>
                    {post.author.is_verified && <VerifiedBadge />}
                    <TierBadge tier={post.author.tier} />
                  </>
                )}
              </View>
              {!isArchivedFrozen && (
                <View style={styles.watermark}>
                  <AkoWatermark />
                </View>
              )}
            </View>

            {/* Role / page-detail row. Page posts show only the PAGE's details
                — tagline, or @handle when it has none; the team member who
                wrote the post is deliberately not surfaced. */}
            {postedAsPage ? (
              <Text numberOfLines={1} style={[styles.detail, { color: colors.inkMuted }]}>
                {postedAsPage.tagline?.trim() || `@${postedAsPage.username}`}
              </Text>
            ) : (
              post.author.roles.length > 0 && (
                <RoleTags
                  roles={post.author.roles}
                  numberOfLines={1}
                  style={{ ...styles.detail, color: colors.inkMuted }}
                />
              )
            )}

            {/* Timestamp row — own line. */}
            <View style={styles.timeRow}>
              <Text style={[styles.time, { color: colors.inkMuted }]}>
                {timeAgo(post.created_at)}
                {post.edited_at ? " · edited" : ""}
              </Text>
              {post.visibility === "public" && <Globe size={11} color={colors.inkMuted} />}
            </View>
          </View>
        </View>

        {/* Header/body divider: the border above draws the line; the reshare
            badge and Follow pill sit right on top of it at the card's true
            right edge, centered vertically on the line, with a card-colored
            pill behind them masking the line. Follow is skipped for page posts
            (following a page happens on its own PagePage) and for your own. */}
        {showDividerBadges && (
          <View
            onLayout={(e: LayoutChangeEvent) => setDividerBadgeHeight(e.nativeEvent.layout.height)}
            style={[
              styles.dividerBadges,
              { backgroundColor: cardBackground, transform: [{ translateY: dividerBadgeHeight / 2 }] },
            ]}
          >
            {plainReshare && <RepostBadge source={original} />}
            {!isOwner && !postedAsPage && (
              <FollowButton authorId={post.author.id} isPrivate={post.author.is_private} />
            )}
          </View>
        )}
      </View>

      {plainReshare && originalGone ? (
        <View style={[styles.unavailable, { borderColor: colors.border, backgroundColor: cardBackground }]}>
          <Text style={[styles.unavailableText, { color: colors.inkMuted }]}>
            {original?.is_archived ? "This post has been archived by its author." : "This post is no longer available."}
          </Text>
        </View>
      ) : (
        <>
          {hasBody && (
            <Pressable onPress={handleContentPress} accessibilityRole="link" style={styles.body}>
              <PostContent
                heading={bodySource.heading}
                headingColor={bodySource.heading_color}
                content={bodySource.content}
              />
            </Pressable>
          )}
          <PostMedia mediaUrls={bodySource.media_urls} />
          {/* TODO(port): {bodySource.music_catalogue_id && <MusicAttribution
              catalogueId={bodySource.music_catalogue_id} postId={post.id} />} */}
        </>
      )}

      {/* Embedded original — quotes only. A quote keeps its own caption above
          and shows the original as a bordered, truncated card underneath, since
          the quote and the original are two distinct, attributed voices. */}
      {quotePost && <RepostEmbed source={original} />}

      <TaggedProjectEmbed project={taggedProject} />

      {/* Time · date · views — only on the expanded (comments-visible) post,
          matching X's post-detail formatting. Feed cards don't show this. */}
      {showStats && (
        <View style={[styles.stats, { borderBottomColor: colors.border }]}>
          <Text style={[styles.statsText, { color: colors.inkMuted }]}>{formatPostTime(post.created_at)}</Text>
          <Text style={[styles.statsText, { color: colors.inkMuted }]}>·</Text>
          <Text style={[styles.statsText, { color: colors.inkMuted }]}>{formatPostDate(post.created_at)}</Text>
          <Text style={[styles.statsText, { color: colors.inkMuted }]}>·</Text>
          <Text style={[styles.statsText, styles.statsCount, { color: colors.ink }]}>
            {formatCompactCount(viewCount)}
          </Text>
          <Text style={[styles.statsText, { color: colors.inkMuted }]}>{viewCount < 2 ? "View" : "Views"}</Text>
        </View>
      )}

      {/* Like fixed left · 3 ranked actions · "···" fixed right · Comments count
          under Like. */}
      <ReactionTray
        leftActions={leftActions}
        middleActions={middleActions}
        rightActions={rightActions}
        onOpenMore={trayFrozen ? undefined : () => setShowMoreActions(true)}
        belowLeftLabel={{ text: `Comments: ${post.comment_count}`, onClick: handleCommentTap }}
        disabled={trayFrozen}
      />

      {showMoreActions && !trayFrozen && (
        <ReactionMoreSheet actions={moreActions} onClose={() => setShowMoreActions(false)} />
      )}

      {/* TODO(port): StanceComposer, CommentSheet, ReshareSheet, GiftPicker,
          TagPeopleSheet, CollaboratorsSheet render here, each gated on its own
          show* state, as on web. */}

      {showArchiveConfirm && (
        <ConfirmDialog
          title="Archive this post?"
          description="It'll be hidden from your profile and the feed until you unarchive it from your Archive."
          confirmLabel="Archive"
          danger={false}
          onConfirm={handleConfirmArchive}
          onCancel={() => setShowArchiveConfirm(false)}
        />
      )}

      {showPrioritizeConfirm && (
        <ConfirmDialog
          title="Prioritize this post?"
          description="This is your one pick for today — it'll take priority over your other posts in people's feeds until they interact with it."
          confirmLabel="Prioritize"
          danger={false}
          onConfirm={handleConfirmPrioritize}
          onCancel={() => setShowPrioritizeConfirm(false)}
        />
      )}

      {prioritizeError && (
        <ConfirmDialog
          title="Couldn't prioritize this post"
          description={prioritizeError}
          confirmLabel="OK"
          danger={false}
          onConfirm={() => setPrioritizeError(null)}
          onCancel={() => setPrioritizeError(null)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete this post?"
          description="This can't be undone."
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </View>
  );
}

// web: flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5
function CornerButton({
  label,
  icon,
  background,
  color,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  background: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.cornerButton, { backgroundColor: background }]}
    >
      {icon}
      <Text style={[styles.cornerButtonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// web: rounded-2xl p-4 mb-4 shadow-[0_0_0_1px_rgba(ink,0.07),0_10px_24px_-6px_rgba(ink,0.16)].
// The 1px ring is a border here (padding drops to 15 to keep the content box
// the same); the drop shadow is a close approximation — RN has no spread.
const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 3,
  },

  // web: absolute top-3 right-3 z-10 flex items-center gap-2
  cornerBar: { position: "absolute", top: 12, right: 12, zIndex: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  cornerButton: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  cornerButtonText: { fontSize: 12, fontWeight: "500" },

  // web: flex items-start gap-3 pb-3.5 border-b
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingBottom: 14, borderBottomWidth: 1 },
  headerText: { flex: 1, minWidth: 0, gap: 2 },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  nameAndBadges: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 },
  // The name takes all remaining width (web: flex-1 truncate), so the badges
  // end up at the row's right edge, next to the watermark.
  nameLink: { flex: 1, minWidth: 0 },
  name: { fontSize: 17, lineHeight: 20, fontWeight: "600" },
  watermark: { paddingLeft: 8 },

  detail: { fontSize: 13, lineHeight: 18 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  time: { fontSize: 12, lineHeight: 18 },

  // web: absolute right-0 bottom-0 translate-y-1/2 flex items-center gap-2 pl-2 rounded-full
  dividerBadges: {
    position: "absolute",
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 8,
    borderRadius: 999,
  },

  body: { marginTop: 12 },

  // web: mt-3 rounded-xl border px-4 py-3 text-sm
  unavailable: { marginTop: 12, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  unavailableText: { fontSize: 14 },

  // web: flex items-center gap-1.5 text-sm mt-3 pb-3 border-b
  stats: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, paddingBottom: 12, borderBottomWidth: 1 },
  statsText: { fontSize: 14 },
  statsCount: { fontWeight: "600" },
});

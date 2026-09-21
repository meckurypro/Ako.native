// File: components/projects/ProjectCard.tsx
import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Pressable, Share, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Icon, Text, type IconName } from "@/components/core";
import { FormattedText } from "@/components/feed/FormattedText";
import { MediaHeroPlayer } from "@/components/projects/MediaHeroPlayer";
import { PrivateProjectNotice } from "@/components/projects/PrivateProjectNotice";
import { SupportPitchSheet } from "@/components/projects/SupportPitchSheet";
import { useStartConversation } from "@/features/messaging/api";
import {
  PROJECT_TYPE_LABELS, getEffectivePrice, hasActivePromo, isProjectFree, useBookDetails, useBookGig, useDeleteProject, useGetProjectFile, useHasPurchased, useIsProjectMember, useIsProjectSaved,
  useLogFreeProjectAccess, useMediaDetails, usePitchDetails, usePitchRaised, useProjectAccessCount, usePurchaseProject, useSetProjectStatus, useToggleSavedProject, type Project,
} from "@/features/projects/api";
import { webUrl } from "@/lib/web-url";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { fonts } from "@/theme/fonts";

// Where a project type's unlocked content lives once you have access. Native has no screen for these yet, so they hand off to the web app.
const HANDOFF: Partial<Record<Project["project_type"], { path: (id: string) => string; label: string; icon: IconName }>> = {
  event: { path: id => `/projects/${id}/ticket`, label: "View ticket", icon: "ticket" },
  meeting: { path: id => `/meetings/${id}`, label: "Go to meeting", icon: "video" },
  course: { path: id => `/courses/${id}`, label: "Continue course", icon: "book-open" },
};

const withProtocol = (raw: string) => (/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);

function Pill({ label, icon, onPress, disabled, loading, tone = "soft" }: { label: string; icon?: IconName; onPress?: () => void; disabled?: boolean; loading?: boolean; tone?: "primary" | "soft" | "muted" }) {
  const { colors, radii } = useTheme();
  const background = tone === "primary" ? colors.accent : tone === "soft" ? colors.accentSoft : colors.surface;
  const foreground = tone === "primary" ? colors.onAccent : tone === "soft" ? colors.accent : colors.textSecondary;
  const content = (
    <>
      {loading ? <ActivityIndicator size="small" color={foreground} /> : icon ? <Icon name={icon} size={15} color={foreground} /> : null}
      <Text style={{ color: foreground, fontSize: 14, lineHeight: 19, fontFamily: fonts.body.semibold }}>{label}</Text>
    </>
  );
  const style = [s.pill, { backgroundColor: background, borderRadius: radii.full, borderColor: tone === "muted" ? colors.border : "transparent", opacity: disabled ? 0.5 : 1 }];
  if (!onPress) return <View style={style}>{content}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [...style, pressed && { opacity: 0.75 }]}>{content}</Pressable>;
}

function TrayButton({ label, icon, active, onPress, disabled }: { label: string; icon: IconName; active?: boolean; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={onPress} hitSlop={6} style={({ pressed }) => [s.tray, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={22} color={active ? colors.accent : colors.text} fill={active ? colors.accent : "none"} />
      <Text variant="caption" color={active ? "accent" : "secondary"}>{label}</Text>
    </Pressable>
  );
}

type MenuItem = { key: string; label: string; icon: IconName; danger?: boolean; disabled?: boolean; onPress: () => void };
function ProjectMenu({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const { colors, radii } = useTheme();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close menu" style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} />
      <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, paddingVertical: 8, paddingBottom: 28 }}>
          {items.map(item => (
            <Pressable key={item.key} accessibilityRole="button" disabled={item.disabled} onPress={() => { onClose(); item.onPress(); }} style={({ pressed }) => [s.menuRow, { opacity: item.disabled ? 0.4 : pressed ? 0.6 : 1 }]}>
              <Icon name={item.icon} size={20} color={item.danger ? colors.danger : colors.text} />
              <Text variant="label" style={{ color: item.danger ? colors.danger : colors.text }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

// The project itself: cover (or media player), title/type/price, and everything you can do with it. Mirrors web's ProjectCard, except that screens native doesn't have yet (ticket, meeting, course, cohort, book reader) hand off to the web app.
export function ProjectCard({ project, isOwnerView, isDetailView, onDeleted }: { project: Project; isOwnerView?: boolean; isDetailView?: boolean; onDeleted?: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, radii } = useTheme();
  const isOwner = isOwnerView ?? user?.id === project.owner_id;
  const isArchivedFrozen = isOwner && project.status === "archived";
  const isFree = isProjectFree(project);
  const showPromo = hasActivePromo(project);
  const effectivePrice = getEffectivePrice(project);
  const isCourseUnpublished = project.project_type === "course" && !project.published_at;
  const isPitch = project.project_type === "pitch";
  const isBook = project.project_type === "book";
  const isRoom = project.project_type === "room";
  const isMedia = project.project_type === "media";

  const hasPurchasedQuery = useHasPurchased(project.id);
  const memberQuery = useIsProjectMember(project.id, project.is_private);
  const savedQuery = useIsProjectSaved(project.id);
  const accessCount = useProjectAccessCount(project.id);
  const mediaDetails = useMediaDetails(isMedia ? project.id : undefined).data;
  const pitchDetails = usePitchDetails(isPitch ? project.id : undefined).data;
  const pitchRaised = usePitchRaised(isPitch ? project.id : undefined).data;
  const bookDetails = useBookDetails(isBook ? project.id : undefined).data;
  const purchase = usePurchaseProject();
  const bookGig = useBookGig();
  const startConversation = useStartConversation();
  const toggleSaved = useToggleSavedProject(project.id);
  const logFreeAccess = useLogFreeProjectAccess();
  const setStatus = useSetProjectStatus();
  const deleteProject = useDeleteProject();
  const getFile = useGetProjectFile();
  const getBook = useGetProjectFile();
  const getAudio = useGetProjectFile();
  const getVideo = useGetProjectFile();
  const getImage = useGetProjectFile();

  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const hasPurchased = !!hasPurchasedQuery.data;
  const isMember = memberQuery.data === true;
  // Privacy is a separate gate from payment: a private project's content is hidden from anyone but the owner and added members, whatever the price.
  const privacyBlocked = project.is_private && !isOwner && !isMember;
  // Rooms are the one type where "free" isn't self-granting: membership only exists once process_project_purchase has run, even at $0.
  const hasAccess = !privacyBlocked && (isOwner || hasPurchased || (isFree && !isRoom));
  const isSaved = !!savedQuery.data;

  const shareUrl = webUrl(project.slug ? `/${project.slug}` : `/projects/${project.id}`);
  const openWeb = (path: string) => void Linking.openURL(webUrl(path)).catch(() => setError("Couldn’t open the web app."));
  const openLink = (url: string) => void Linking.openURL(withProtocol(url)).catch(() => setError("Couldn’t open that link."));
  const shareLink = (url: string) => void Share.share({ message: url });
  // Only a FREE, non-owner unlock needs this client-side log; paid access is logged by purchase-project.
  const logFree = (accessType: "download" | "stream" | "link_click") => { if (isFree && !isOwner) logFreeAccess.mutate({ projectId: project.id, accessType }); };

  const confirmPay = (title: string, action: () => void) => {
    if (effectivePrice <= 0) { action(); return; }
    Alert.alert(title, `This will use $${effectivePrice.toFixed(2)} from your wallet.`, [{ text: "Cancel", style: "cancel" }, { text: "Pay", onPress: action }]);
  };
  const buy = () => confirmPay(`Buy “${project.title}”?`, () => {
    setError(null);
    purchase.mutate(project.id, { onSuccess: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), onError: err => setError(err.message || "Purchase failed.") });
  });
  const bookThisGig = () => confirmPay(`Book “${project.title}”?`, () => {
    setError(null);
    bookGig.mutate(project.id, { onSuccess: ({ conversationId }) => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); router.push({ pathname: "/messages/[conversationId]", params: { conversationId } }); }, onError: err => setError(err.message || "Booking failed.") });
  });
  const message = (draft?: string) => {
    setError(null);
    startConversation.mutate(project.owner_id, { onSuccess: conversationId => router.push({ pathname: "/messages/[conversationId]", params: draft ? { conversationId, draft } : { conversationId } }), onError: err => setError(err.message || "Couldn’t start conversation.") });
  };
  const joinRoom = () => { if (hasAccess) openWeb(`/rooms/${project.id}`); else buy(); };

  const loadFile = (mutation: typeof getFile, kind: "file" | "audio" | "video" | "image" | "book", onUrl: (url: string) => void, access: "download" | "stream") => {
    setError(null);
    mutation.mutate({ projectId: project.id, kind }, { onSuccess: url => { onUrl(url); logFree(access); }, onError: err => setError(err.message) });
  };
  const downloadFile = () => loadFile(getFile, "file", url => openLink(url), "download");
  const downloadBook = () => loadFile(getBook, "book", url => openLink(url), "download");
  const loadAudio = () => loadFile(getAudio, "audio", setAudioSrc, "stream");
  const loadVideo = () => loadFile(getVideo, "video", setVideoSrc, "stream");
  const viewImage = () => loadFile(getImage, "image", setImageSrc, "stream");

  const setProjectStatus = (status: "active" | "draft" | "archived") => setStatus.mutate({ id: project.id, status }, { onError: err => setError(err.message || "Couldn’t update this project.") });
  const confirmDelete = () => Alert.alert("Delete this project?", "This can’t be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteProject.mutate(project.id, { onSuccess: () => onDeleted?.(), onError: err => setError(err.message || "Couldn’t delete this project.") }) }]);

  const menuItems: MenuItem[] = [{ key: "share", label: "Share", icon: "redo-2", onPress: () => shareLink(shareUrl) }];
  if (project.status !== "active" && project.status !== "cancelled") menuItems.push({ key: "publish", label: "Publish", icon: "send", onPress: () => setProjectStatus("active") });
  if (project.status === "active") menuItems.push({ key: "unpublish", label: "Unpublish", icon: "eye-off", onPress: () => setProjectStatus("draft") });
  if (project.status !== "archived") menuItems.push({ key: "archive", label: "Archive", icon: "archive", danger: true, onPress: () => setProjectStatus("archived") });
  if (project.status === "archived") menuItems.push({ key: "restore", label: "Restore", icon: "rotate-ccw", onPress: () => setProjectStatus("draft") });
  menuItems.push({ key: "delete", label: deleteProject.isPending ? "Deleting…" : "Delete", icon: "trash-2", danger: true, disabled: deleteProject.isPending, onPress: confirmDelete });

  // Video wins when a media project has both channels; null means there's no uploaded preview file (image-only, or link-only channels), so the plain thumbnail shows.
  const primaryMediaKind: "audio" | "video" | null = isMedia && mediaDetails?.has_video && mediaDetails.video_file_path ? "video" : isMedia && mediaDetails?.has_audio && mediaDetails.audio_file_path ? "audio" : null;
  const aspectRatio = project.thumbnail_width && project.thumbnail_height ? project.thumbnail_width / project.thumbnail_height : 16 / 9;
  const showOwnerBadges = isOwner && (project.status !== "active" || project.is_private);
  const handoff = HANDOFF[project.project_type];
  const isInline = project.project_type === "file" || project.project_type === "url";
  const isBookDraftUnpublished = isBook && bookDetails?.content_source === "authored" && !project.published_at;

  return (
    <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.xl }]}>
      <View style={{ aspectRatio, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {primaryMediaKind ? (
          <MediaHeroPlayer kind={primaryMediaKind} thumbnailUrl={project.thumbnail_url} hasAccess={hasAccess} previewSrc={primaryMediaKind === "video" ? videoSrc : audioSrc} isLoadingPreview={primaryMediaKind === "video" ? getVideo.isPending : getAudio.isPending} onLoadPreview={primaryMediaKind === "video" ? loadVideo : loadAudio} autoLoadOnMount={!!isDetailView} />
        ) : project.thumbnail_url ? (
          <Image source={{ uri: project.thumbnail_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} />
        ) : (
          <Icon name="image" size={32} color={colors.textMuted} />
        )}
      </View>

      {showOwnerBadges ? (
        <View style={s.badges}>
          {project.status !== "active" ? <View style={s.badge}><Text style={s.badgeText}>{project.status === "draft" ? "Draft" : project.status === "cancelled" ? "Cancelled" : "Archived"}</Text></View> : null}
          {project.is_private ? <View style={[s.badge, { flexDirection: "row", alignItems: "center", gap: 4 }]}><Icon name="eye-off" size={10} color="#fff" /><Text style={s.badgeText}>Private</Text></View> : null}
        </View>
      ) : null}
      {isOwner ? <Pressable accessibilityRole="button" accessibilityLabel="Project options" hitSlop={8} onPress={() => setMenuOpen(true)} style={s.menuButton}><Icon name="more-horizontal" size={16} color="#fff" /></Pressable> : null}

      <View style={s.body}>
        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <Text variant="heading" numberOfLines={isDetailView ? undefined : 2}>{project.title}</Text>
            <View style={s.metaRow}>
              <Text variant="caption" color="secondary">{PROJECT_TYPE_LABELS[project.project_type]}</Text>
              {(accessCount.data ?? 0) > 0 ? <View style={s.metaRow}><Text variant="caption" color="muted">·</Text><Icon name="eye" size={11} color={colors.textMuted} /><Text variant="caption" color="secondary">{accessCount.data}</Text></View> : null}
            </View>
          </View>
          <View style={[s.price, { backgroundColor: colors.accentSoft, borderRadius: radii.full }]}>
            {isPitch ? <Text variant="label" color="accent">${(pitchRaised ?? 0).toFixed(0)} raised</Text>
              : isFree && project.project_type === "gig" ? <Text variant="label" color="accent">Message to inquire</Text>
              : isFree ? <Text variant="label" color="accent">Free</Text>
              : showPromo ? <Text variant="label" color="accent"><Text variant="caption" color="muted" style={{ textDecorationLine: "line-through" }}>${project.price_usd.toFixed(2)}</Text>{"  "}${effectivePrice.toFixed(2)}</Text>
              : <Text variant="label" color="accent">${project.price_usd.toFixed(2)}</Text>}
          </View>
        </View>

        {privacyBlocked ? (
          <PrivateProjectNotice onMessage={() => message(`Hi! I'd like access to "${project.title}".`)} messagePending={startConversation.isPending} />
        ) : (
          <>
            {project.description ? <Text color="secondary"><FormattedText value={project.description} /></Text> : null}

            {isPitch && pitchDetails ? (
              <View style={{ gap: 6 }}>
                <View style={[s.track, { backgroundColor: colors.border }]}><View style={[s.fill, { backgroundColor: colors.accent, width: `${Math.min(100, ((pitchRaised ?? 0) / Math.max(pitchDetails.goal_amount_usd, 1)) * 100)}%` }]} /></View>
                <Text variant="caption" color="secondary">${(pitchRaised ?? 0).toFixed(0)} raised of ${pitchDetails.goal_amount_usd.toFixed(0)} goal</Text>
              </View>
            ) : null}

            {error ? <Text variant="caption" color="danger" accessibilityRole="alert">{error}</Text> : null}

            {isMedia && mediaDetails ? (
              <View style={{ gap: 10 }}>
                {mediaDetails.has_audio && mediaDetails.has_video
                  ? hasAccess && mediaDetails.audio_url ? <View style={s.row}><Pill icon="music" label="Listen to the full song" onPress={() => openLink(mediaDetails.audio_url!)} /></View> : null
                  : mediaDetails.has_audio
                    ? hasAccess && mediaDetails.audio_url ? <View style={s.row}><Pill icon="music" label="Go to full track" onPress={() => openLink(mediaDetails.audio_url!)} /></View> : null
                    : hasAccess && mediaDetails.video_url ? <View style={s.row}><Pill icon="video" label="Go to full video" onPress={() => openLink(mediaDetails.video_url!)} /></View> : null}
                {mediaDetails.has_image ? (
                  !hasAccess ? <View style={s.row}><Pill tone="muted" icon="lock" label="Image locked" /></View>
                    : imageSrc ? (
                      <View style={{ gap: 8 }}>
                        <Image source={{ uri: imageSrc }} style={{ width: "100%", aspectRatio: 1, borderRadius: radii.md }} contentFit="cover" />
                        <View style={s.row}><Pill icon="download" label="Open" onPress={() => openLink(imageSrc)} /><Pill icon="copy" label="Share link" onPress={() => shareLink(imageSrc)} /></View>
                        <Text variant="caption" color="muted">Link expires after a while — share again if it stops working.</Text>
                      </View>
                    ) : <View style={s.row}><Pill icon="image" label={getImage.isPending ? "Loading…" : "View image"} loading={getImage.isPending} onPress={viewImage} /></View>
                ) : null}
              </View>
            ) : null}

            {isBook && bookDetails && hasAccess ? (
              <View style={s.row}>
                {bookDetails.content_source === "link" && bookDetails.external_url ? <Pill icon="link" label="Open link" onPress={() => { logFree("link_click"); openLink(bookDetails.external_url!); }} /> : null}
                {bookDetails.content_source === "upload" && bookDetails.allow_read_in_app ? <Pill icon="book-text" label="Read" onPress={() => { logFree("stream"); openWeb(`/projects/${project.id}/read`); }} /> : null}
                {bookDetails.content_source === "upload" && bookDetails.allow_download ? <Pill icon="download" label={getBook.isPending ? "Preparing…" : "Download"} loading={getBook.isPending} onPress={downloadBook} /> : null}
                {bookDetails.content_source === "authored" ? <Pill icon="book-open" label={isOwner && !project.published_at ? "Continue building" : "Read"} onPress={() => openWeb(`/books/${project.id}`)} /> : null}
              </View>
            ) : null}
            {isBook && bookDetails && !hasAccess && !isOwner ? <View style={s.row}><Pill tone="muted" icon="lock" label="Locked" /></View> : null}

            <View style={s.row}>
              {project.project_type === "file" ? (hasAccess ? <Pill icon="download" label={getFile.isPending ? "Preparing…" : "Download"} loading={getFile.isPending} onPress={downloadFile} /> : <Pill tone="muted" icon="lock" label="Locked" />) : null}
              {project.project_type === "url" ? (hasAccess && project.external_url ? (
                <>
                  <Pill icon="link" label="Open link" onPress={() => { logFree("link_click"); openLink(project.external_url!); }} />
                  <Pill icon="copy" label="Share" onPress={() => shareLink(project.external_url!)} />
                </>
              ) : hasAccess ? null : <Pill tone="muted" icon="lock" label="Locked" />) : null}

              {!isInline && !isMedia && !isBook && hasAccess && handoff ? (
                <Pill icon={project.project_type === "event" && isOwner ? "qr-code" : handoff.icon} label={project.project_type === "event" && isOwner ? "Scan tickets" : handoff.label} onPress={() => openWeb(project.project_type === "event" && isOwner ? `/projects/${project.id}/checkin` : handoff.path(project.id))} />
              ) : null}
              {!isInline && !isMedia && !isBook && project.project_type !== "gig" && !isPitch && !hasAccess && !isCourseUnpublished ? <Pill tone="muted" icon="lock" label="Locked" /> : null}
              {isCourseUnpublished && isOwner ? <Pill tone="muted" label="Not published yet" /> : null}
              {isBookDraftUnpublished && isOwner ? <Pill tone="muted" label="Not published yet" /> : null}

              {project.project_type === "gig" && !isOwner ? <Pill icon="message-circle" label={startConversation.isPending ? "Opening…" : "Message"} loading={startConversation.isPending} onPress={() => message()} /> : null}
              {project.project_type === "gig" && !isOwner && !isFree && hasPurchased ? <Pill tone="muted" label="Booked ✓" /> : null}
              {isPitch && !isOwner ? <Pill icon="heart" label="Support" onPress={() => setSupportOpen(true)} /> : null}

              {!isRoom && !isPitch && !hasAccess && !isCourseUnpublished && !isBookDraftUnpublished ? (
                <Pill tone="primary" loading={project.project_type === "gig" ? bookGig.isPending : purchase.isPending} onPress={project.project_type === "gig" ? bookThisGig : buy}
                  label={project.project_type === "gig" ? `Book for $${effectivePrice.toFixed(2)}` : project.project_type === "event" ? `Buy ticket $${effectivePrice.toFixed(2)}` : project.project_type === "url" ? `Get access for $${effectivePrice.toFixed(2)}` : `Buy for $${effectivePrice.toFixed(2)}`} />
              ) : null}
            </View>

            {(!isOwner || isRoom) ? (
              <View style={[s.trayRow, { borderTopColor: colors.border }]}>
                {!isOwner ? <TrayButton label={isSaved ? "Saved" : "Save"} icon="bookmark" active={isSaved} disabled={isArchivedFrozen || toggleSaved.isPending} onPress={() => toggleSaved.mutate(isSaved)} /> : null}
                {isRoom ? <TrayButton label={hasAccess ? "Enter cohort" : "Join cohort"} icon="users" active={hasAccess} disabled={isArchivedFrozen || purchase.isPending} onPress={joinRoom} /> : null}
                {!isOwner ? <TrayButton label="Share" icon="redo-2" disabled={isArchivedFrozen} onPress={() => shareLink(shareUrl)} /> : null}
              </View>
            ) : null}
          </>
        )}
      </View>

      {menuOpen ? <ProjectMenu items={menuItems} onClose={() => setMenuOpen(false)} /> : null}
      {supportOpen ? <SupportPitchSheet projectId={project.id} projectTitle={project.title} onClose={() => setSupportOpen(false)} onSupported={() => { setSupportOpen(false); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); Alert.alert("Thanks for backing this idea 🎉"); }} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, overflow: "hidden", marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  body: { padding: 16, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  price: { paddingHorizontal: 12, paddingVertical: 6 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  pill: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth },
  tray: { alignItems: "center", gap: 3, minWidth: 64 },
  trayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  badges: { position: "absolute", top: 12, left: 12, flexDirection: "row", gap: 6 },
  badge: { borderRadius: 99, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: "#fff", fontSize: 11, lineHeight: 15, fontFamily: fonts.body.semibold },
  menuButton: { position: "absolute", top: 12, right: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 24, paddingVertical: 14 },
});

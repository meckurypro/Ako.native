// File: app/projects/[projectId].tsx
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Avatar, Icon, PressableScale, Screen, Text, VerifiedBadge, type IconName } from "@/components/core";
import { ErrorState, OfflineState, Skeleton } from "@/components/feedback";
import { getScreenState } from "@/lib/screenState";
import { FaqList, ProjectFaqSection } from "@/components/projects/ProjectFaqSection";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectMiniCard, ProjectRail } from "@/components/projects/ProjectMiniCard";
import {
  PROJECT_TYPE_LABELS, useEventDetails, useGigDetails, useGigWorkSamples, useGigsFeaturingProject, useMarkProjectSeen, useMeetingDetails, useProjectDetail, useSimilarProjects,
} from "@/features/projects/api";
import { addEventToDeviceCalendar } from "@/lib/deviceCalendar";
import { useTheme } from "@/providers/ThemeProvider";
import { fonts } from "@/theme/fonts";

const TIER_LABELS: Record<string, string> = { contributor: "Contributor", publisher: "Publisher", host: "Host", creator_business: "Creator" };
const PAGE_MODE_LABELS: Record<string, string> = { organization: "Organisation", brand: "Brand", product: "Product" };

// Ticks once a second toward `target`; null until the first tick or when there's no target (web's useCountdown).
function useCountdown(target: string | null | undefined) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!target) return;
    const tick = () => setRemaining(new Date(target).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return remaining;
}
function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400), h = Math.floor((total % 86400) / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

// Fallback only: opens a prefilled Google Calendar event in the browser.
// addEventToDeviceCalendar() (lib/deviceCalendar.ts) is the primary path now
// — this only runs if the user declines/blocks the calendar permission or
// the device has no writable calendar (web downloads an .ics file instead).
function calendarUrl(event: { title: string; description?: string | null; location?: string; startIso: string }) {
  const start = new Date(event.startIso);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = [`text=${encodeURIComponent(event.title)}`, `dates=${stamp(start)}/${stamp(end)}`, event.description ? `details=${encodeURIComponent(event.description)}` : "", event.location ? `location=${encodeURIComponent(event.location)}` : ""].filter(Boolean).join("&");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&${params}`;
}

function InfoLine({ icon, children }: { icon: IconName; children: string }) {
  const { colors } = useTheme();
  return <View style={s.infoLine}><Icon name={icon} size={14} color={colors.textMuted} /><Text variant="label" color="secondary" style={{ flex: 1, fontFamily: fonts.body.regular }}>{children}</Text></View>;
}
function LinkAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="link" onPress={onPress} hitSlop={6} style={s.infoLine}><Icon name={icon} size={15} color={colors.accent} /><Text variant="label" color="accent">{label}</Text></Pressable>;
}

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { colors, radii } = useTheme();
  const { projectId: rawId } = useLocalSearchParams<{ projectId: string }>();
  const projectId = typeof rawId === "string" ? rawId : undefined;
  const detail = useProjectDetail(projectId);
  const project = detail.data;
  const similar = useSimilarProjects(project);
  const isEvent = project?.project_type === "event";
  const isMeeting = project?.project_type === "meeting";
  const isGig = project?.project_type === "gig";
  const eventDetails = useEventDetails(isEvent ? projectId : undefined).data;
  const meetingDetails = useMeetingDetails(isMeeting ? projectId : undefined).data;
  const gigDetails = useGigDetails(isGig ? projectId : undefined).data;
  const gigSamples = useGigWorkSamples(isGig ? projectId : undefined).data;
  // The reverse direction: gig pages this project is featured on as a work sample (never applies to a gig itself).
  const featuringGigs = useGigsFeaturingProject(project && !isGig ? projectId : undefined).data;
  const countdown = useCountdown(isEvent ? eventDetails?.event_date : undefined);
  useMarkProjectSeen(projectId, project?.owner?.id);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"));
  const openUrl = (url: string) => void Linking.openURL(url).catch(() => undefined);
  const addToCalendar = async (event: { title: string; description?: string | null; location?: string; startIso: string }) => {
    const added = await addEventToDeviceCalendar(event);
    if (added) Alert.alert("Added to calendar", "This event is now on your device calendar.");
    else openUrl(calendarUrl(event)); // permission declined/blocked, or no writable calendar — same fallback as before
  };
  const page = project?.posted_as_page ?? null;
  const openCreator = () => {
    if (!project) return;
    if (page) router.push({ pathname: "/pages/[username]", params: { username: page.username } });
    else router.push({ pathname: "/profiles/[username]", params: { username: project.owner.username } });
  };

  return (
    <Screen>
      <View style={s.topRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} hitSlop={8} style={[s.back, { backgroundColor: colors.surface, borderColor: colors.border }]}><Icon name="arrow-left" size={20} color={colors.textSecondary} /></Pressable>
      </View>

      {getScreenState(detail) === "offline" ? (
        <OfflineState onRetry={() => void detail.refetch()} />
      ) : detail.isLoading ? (
        <View style={{ gap: 12 }}><Skeleton height={200} radius={28} /><Skeleton width="70%" height={24} /><Skeleton height={16} /><Skeleton width="85%" height={16} /></View>
      ) : detail.isError || !project ? (
        <ErrorState message="This project may have been removed, or you may not have access to it." onRetry={() => void detail.refetch()} />
      ) : (
        <>
          <ProjectCard project={project} isDetailView onDeleted={goBack} />

          {featuringGigs && featuringGigs.length > 0 ? (
            <View style={s.chips}>
              {featuringGigs.map(gig => (
                <PressableScale key={gig.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/projects/[projectId]", params: { projectId: gig.id } })} style={[s.chip, { backgroundColor: colors.accentSoft, borderRadius: radii.full }]}>
                  <Icon name="briefcase" size={14} color={colors.accent} />
                  <Text variant="label" color="accent">{gig.role_label ? `Featured in ${gig.role_label} gig` : "View the gig this is part of"}</Text>
                </PressableScale>
              ))}
            </View>
          ) : null}

          {isEvent && eventDetails ? (
            <View style={s.block}>
              {eventDetails.event_date ? <InfoLine icon="calendar-clock">{new Date(eventDetails.event_date).toLocaleString()}</InfoLine> : null}
              <InfoLine icon="map-pin">{eventDetails.location_type === "physical" ? eventDetails.location_value : "Online"}</InfoLine>
              {eventDetails.event_date && countdown !== null && countdown > 0 ? <Text variant="label" color="accent">Starts in {formatCountdown(countdown)}</Text> : null}
              <View style={s.actionsRow}>
                {eventDetails.event_date ? <LinkAction icon="calendar-plus" label="Add to calendar" onPress={() => void addToCalendar({ title: project.title, description: project.description, location: eventDetails.location_value || undefined, startIso: eventDetails.event_date! })} /> : null}
                {eventDetails.location_type === "physical" && eventDetails.location_value ? <LinkAction icon="navigation" label="Directions" onPress={() => openUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventDetails.location_value)}`)} /> : null}
              </View>
            </View>
          ) : null}
          {isMeeting && meetingDetails ? <View style={s.block}><InfoLine icon="video">{new Date(meetingDetails.scheduled_at).toLocaleString()}</InfoLine></View> : null}

          {isGig && gigDetails?.tagline ? <Text variant="label" style={{ marginBottom: 8 }}>{gigDetails.tagline}</Text> : null}
          {isGig && (gigDetails?.delivery_estimate || (gigDetails?.revisions_included !== null && gigDetails?.revisions_included !== undefined)) ? (
            <View style={s.block}>
              {gigDetails?.delivery_estimate ? <InfoLine icon="clock">{gigDetails.delivery_estimate}</InfoLine> : null}
              {gigDetails?.revisions_included !== null && gigDetails?.revisions_included !== undefined ? <InfoLine icon="refresh-cw">{`${gigDetails.revisions_included} revision${gigDetails.revisions_included === 1 ? "" : "s"}`}</InfoLine> : null}
            </View>
          ) : null}
          {isGig && gigDetails?.deliverables?.length ? (
            <View style={[s.block, { marginBottom: 16 }]}>{gigDetails.deliverables.map((item, index) => <View key={index} style={s.infoLine}><Icon name="check" size={14} color={colors.accent} /><Text color="secondary" style={{ flex: 1 }}>{item}</Text></View>)}</View>
          ) : null}
          {isGig && gigSamples?.length ? (
            <View style={{ marginBottom: 16 }}>
              <Text variant="heading" style={{ marginBottom: 12 }}>Work samples</Text>
              <View style={s.rail}>{gigSamples.map(sample => <ProjectMiniCard key={sample.id} project={sample} />)}</View>
            </View>
          ) : null}
          {isGig && gigDetails?.faq?.length ? <FaqList items={gigDetails.faq} /> : null}

          <ProjectFaqSection projectId={project.id} />

          {project.topics.length > 0 ? (
            <View style={s.chips}>{project.topics.map(topic => <View key={topic.id} style={[s.topic, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.full }]}><Text variant="caption" color="secondary">{topic.name}</Text></View>)}</View>
          ) : null}

          {/* Creator byline: a page-published project shows the page (its name and "Brand"/"Organisation") in place of the owner. The owner is still the creating user underneath; this is a display swap only. */}
          <PressableScale accessibilityRole="button" accessibilityLabel={`Open ${page ? page.name : project.owner.display_name}`} onPress={openCreator} style={[s.byline, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
            {page ? (
              <>
                <Avatar uri={page.avatar_url} name={page.name} size={52} />
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}><Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>{page.name}</Text>{page.is_verified ? <VerifiedBadge size={15} /> : null}</View>
                  {page.page_type ? <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>{PAGE_MODE_LABELS[page.page_type] ?? page.page_type}</Text> : null}
                  <Text variant="caption" color="secondary">@{page.username}</Text>
                </View>
              </>
            ) : (
              <>
                <Avatar uri={project.owner.avatar_url} name={project.owner.display_name} size={52} />
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}>
                    <Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>{project.owner.display_name}</Text>
                    {TIER_LABELS[project.owner.tier] ? <View style={[s.tier, { backgroundColor: colors.accentSoft }]}><Text color="accent" style={s.tierText}>{TIER_LABELS[project.owner.tier]}</Text></View> : null}
                  </View>
                  {project.owner.roles.length > 0 ? <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>{project.owner.roles.map(role => role.label).join(" · ")}</Text> : null}
                  <Text variant="caption" color="secondary">@{project.owner.username}</Text>
                </View>
              </>
            )}
          </PressableScale>

          <ProjectRail title={`More from ${page ? page.name : project.owner.display_name}`} projects={similar.data?.moreFromCreator ?? []} />
          <ProjectRail title="Similar topics" projects={similar.data?.moreOnTopic ?? []} />
          <ProjectRail title={`More ${PROJECT_TYPE_LABELS[project.project_type]}s`} projects={similar.data?.moreOfType ?? []} />
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  topRow: { paddingTop: 12, paddingBottom: 16 },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  block: { gap: 6, marginBottom: 16 },
  infoLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionsRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 16, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
  topic: { paddingHorizontal: 12, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth },
  rail: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  byline: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  tier: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  tierText: { fontSize: 12, lineHeight: 14, fontFamily: fonts.body.medium },
});

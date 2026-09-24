import { ActivityIndicator, Platform, FlatList, Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/core/Icon";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import { Text } from "@/components/core";
import { type MyGig, useMyGigs } from "@/features/projects/api";
import { useTheme } from "@/providers/ThemeProvider";
import { OfflineState } from "@/components/feedback";
import { getScreenState } from "@/lib/screenState";

const STATUS_LABEL: Record<string, string> = { draft: "Draft", archived: "Archived", cancelled: "Cancelled" };
const SOURCE_LABEL: Record<MyGig["source"], string> = { manual: "Created manually", auto_project: "Started from a project", auto_collaboration: "Started from a collaboration" };

type Section = { key: string; title: string; rows: MyGig[]; showSource?: boolean };

function groupGigs(gigs: MyGig[]): Section[] {
  const incomplete = gigs.filter((gig) => !gig.is_complete);
  const complete = gigs.filter((gig) => gig.is_complete);
  const sections: Section[] = incomplete.length ? [{ key: "needs-attention", title: "Needs attention", rows: incomplete, showSource: true }] : [];
  const byCategory = new Map<string, MyGig[]>();
  for (const gig of complete) {
    const category = gig.category ?? "Other";
    const rows = byCategory.get(category) ?? [];
    rows.push(gig);
    byCategory.set(category, rows);
  }
  for (const [category, rows] of byCategory) sections.push({ key: category, title: category, rows });
  return sections;
}

export default function GigsScreen() {
  const { colors } = useTheme();
  const gigs = useMyGigs();
  const sections = groupGigs(gigs.data ?? []);
  return <View style={[s.root, { backgroundColor: colors.background }]}><PlainHeader />{getScreenState(gigs) === "offline" ? <OfflineState onRetry={() => void gigs.refetch()} /> : gigs.isLoading ? <ActivityIndicator color={colors.accent} style={s.loader} /> : sections.length === 0 ? <GigsEmpty /> : <FlatList data={sections} keyExtractor={(item) => item.key} contentContainerStyle={s.list} renderItem={({ item }) => <GigSection section={item} />} /> }<BottomNavigation /></View>;
}

function PlainHeader() {
  const router = useRouter();
  const { colors } = useTheme();
  return <View style={s.header}><Pressable onPress={() => router.back()} style={s.back}><Icon name="arrow-left" size={22} color={colors.textSecondary} /></Pressable><Text style={s.title}>Your Gigs</Text><Text color="secondary" style={s.subtitle}>Every professional identity on your account — one Gig per role.</Text></View>;
}

function GigSection({ section }: { section: Section }) {
  const { colors } = useTheme();
  return <View style={s.section}><Text style={[s.sectionTitle, { color: colors.textMuted }]}>{section.title}</Text>{section.rows.map((gig) => <View key={gig.id} style={s.gigWrap}><GigRow gig={gig} />{section.showSource && gig.source !== "manual" ? <Text color="muted" style={s.sourceText}>{SOURCE_LABEL[gig.source]}</Text> : null}</View>)}</View>;
}

function GigRow({ gig }: { gig: MyGig }) {
  const { colors } = useTheme();
  const status = gig.status !== "active" ? STATUS_LABEL[gig.status] ?? gig.status : null;
  const role = `${gig.role_label ?? "No role set"}${status ? ` · ${status}` : ""}`;
  return <Pressable style={[s.gigRow, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[s.thumb, { backgroundColor: colors.background }]}>{gig.thumbnail_url ? <Image source={{ uri: gig.thumbnail_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="briefcase" size={18} color={colors.textMuted} />}</View><View style={s.copy}><Text numberOfLines={1} style={s.gigTitle}>{gig.title}</Text><Text color="muted" numberOfLines={1} style={s.gigMeta}>{role}</Text></View>{!gig.is_complete ? <View style={[s.finishPill, { backgroundColor: colors.accentSoft }]}><Text color="accent" style={s.finishText}>Finish setup</Text></View> : null}</Pressable>;
}

function GigsEmpty() {
  const { colors } = useTheme();
  return <View style={s.empty}><Icon name="briefcase" size={32} color={colors.textMuted} /><Text color="muted" align="center" style={s.emptyTitle}>No Gigs yet.</Text><Text color="muted" align="center" style={s.emptyMessage}>Create one from the + button, or get credited as a collaborator and accept it — either way, it shows up here.</Text></View>;
}

function FeedIcon({ color }: { color: string }) {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 11.5 12 4l9 7.5" /><Path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" /></Svg>;
}

function LibraryIcon({ color }: { color: string }) {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><Rect width={8} height={18} x={3} y={3} rx={1} /><Path d="M7 3v18" /><Path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z" /></Svg>;
}

function BottomNavigation() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "android" ? Math.max(insets.bottom, 34) : insets.bottom;
  const items = [
    { label: "Feed", onPress: () => router.push("/(tabs)/home"), icon: <FeedIcon color={colors.textMuted} /> },
    { label: "Discover", onPress: () => router.push("/(tabs)/discover"), icon: <Icon name="search" size={24} color={colors.textMuted} strokeWidth={1.75} /> },
    { label: "Library", onPress: () => router.push("/(tabs)/create"), icon: <LibraryIcon color={colors.textMuted} /> },
    { label: "Messages", onPress: () => router.push("/(tabs)/inbox"), icon: <Icon name="message-circle" size={24} color={colors.textMuted} strokeWidth={1.75} /> },
    { label: "Profile", onPress: () => router.push("/(tabs)/profile"), icon: <Icon name="user" size={24} color={colors.textMuted} strokeWidth={1.75} /> },
  ];
  return <View style={[s.bottomNav, { backgroundColor: colors.surface, borderTopColor: colors.border, height: 76 + bottomInset, paddingBottom: bottomInset }]}>{items.map((item) => <Pressable key={item.label} onPress={item.onPress} style={s.navItem}>{item.icon}<Text color="muted" style={s.navLabel}>{item.label}</Text></Pressable>)}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 28, paddingBottom: 14 },
  back: { width: 28, height: 32, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  title: { fontFamily: "serif", fontSize: 28, lineHeight: 34 },
  subtitle: { marginTop: 2, maxWidth: 340, fontSize: 14, lineHeight: 20 },
  loader: { marginTop: 48 },
  list: { paddingHorizontal: 18, paddingBottom: 110 },
  section: { marginTop: 10, marginBottom: 14 },
  sectionTitle: { marginBottom: 8, fontSize: 11, lineHeight: 15, fontWeight: "700", textTransform: "uppercase", letterSpacing: .7 },
  gigWrap: { marginBottom: 8 },
  gigRow: { minHeight: 72, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: 8, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0 },
  gigTitle: { fontSize: 14, lineHeight: 19 },
  gigMeta: { marginTop: 2, fontSize: 12, lineHeight: 16 },
  finishPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  finishText: { fontSize: 11, lineHeight: 14, fontWeight: "600" },
  sourceText: { marginTop: 4, paddingHorizontal: 4, fontSize: 11, lineHeight: 14 },
  empty: { marginTop: 72, paddingHorizontal: 32, alignItems: "center" },
  emptyTitle: { marginTop: 12, fontSize: 14, lineHeight: 19 },
  emptyMessage: { marginTop: 4, maxWidth: 340, fontSize: 12, lineHeight: 17 },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, height: 76, borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", flexDirection: "row", paddingTop: 13 },
  navItem: { flex: 1, alignItems: "center", gap: 5 },
  navLabel: { fontSize: 11, lineHeight: 14, fontWeight: "500" },
});

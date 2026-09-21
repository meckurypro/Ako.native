import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/core";
import { ErrorState } from "@/components/feedback";
import { type LibraryItem, type LibraryItemType, libraryItemUrl, useLibrary } from "@/features/library/api";
import { useTheme } from "@/providers/ThemeProvider";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const SECTIONS: { title: string; types: LibraryItemType[] }[] = [{ title: "Books & courses", types: ["book", "course"] }, { title: "Media, files & links", types: ["media", "file", "url"] }];
const ICONS: Record<LibraryItemType, IconName> = { book: "book-open-page-variant-outline", course: "school-outline", media: "music-note", file: "file-document-outline", url: "link-variant" };
const LABELS: Record<LibraryItemType, string> = { book: "Book", course: "Course", media: "Media", file: "File", url: "Link" };

function LibraryRow({ item }: { item: LibraryItem }) {
  const { colors } = useTheme(); const unavailable = item.status === "archived";
  return <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(libraryItemUrl(item))} style={({ pressed }) => [s.row, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? .7 : 1 }]}><View style={[s.thumbnail, { backgroundColor: colors.background }]}>{item.thumbnailUrl ? <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <MaterialCommunityIcons name="image-outline" size={19} color={colors.textMuted} />}</View><View style={s.rowCopy}><Text numberOfLines={1} style={s.rowTitle}>{item.title}</Text><View style={s.rowMeta}><MaterialCommunityIcons name={ICONS[item.projectType]} size={13} color={colors.textMuted} /><Text numberOfLines={1} color="muted" style={s.metaText}>{LABELS[item.projectType]} · {item.acquiredVia === "purchased" ? "Purchased" : "Free"}{unavailable ? " · Archived by creator" : ""}</Text></View></View></Pressable>;
}

export default function LibraryScreen() {
  const router = useRouter(); const { colors } = useTheme(); const library = useLibrary(); const items = library.data ?? [];
  return <SafeAreaView edges={["top", "left", "right"]} style={[s.root, { backgroundColor: colors.background }]}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={library.isRefetching} onRefresh={() => void library.refetch()} tintColor={colors.accent} />}><Pressable accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/home")} style={s.back}><MaterialCommunityIcons name="arrow-left" size={23} color={colors.textSecondary} /></Pressable><Text style={s.title}>Library</Text>{library.isLoading ? <View style={s.loading}><ActivityIndicator color={colors.accent} /><Text color="muted">Loading…</Text></View> : library.isError ? <ErrorState message="Couldn't load your library." onRetry={() => void library.refetch()} /> : !items.length ? <View style={s.empty}><MaterialCommunityIcons name="bookshelf" size={25} color={colors.textMuted} /><Text color="muted" align="center" style={s.emptyText}>Books, courses, media, files, and links you buy or open will show up here.</Text></View> : SECTIONS.map((section) => { const rows = items.filter((item) => section.types.includes(item.projectType)); if (!rows.length) return null; return <View key={section.title} style={s.section}><Text color="muted" style={s.sectionTitle}>{section.title}</Text><View style={s.rows}>{rows.map((item) => <LibraryRow key={item.projectId} item={item} />)}</View></View>; })}</ScrollView></SafeAreaView>;
}

const s = StyleSheet.create({ root: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 34 }, back: { width: 38, height: 38, marginLeft: -7, alignItems: "center", justifyContent: "center", marginBottom: 4 }, title: { fontFamily: "serif", fontSize: 25, lineHeight: 32, marginBottom: 24 }, loading: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 10 }, empty: { flex: 1, minHeight: 360, alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 28 }, emptyText: { maxWidth: 300, fontSize: 14, lineHeight: 20 }, section: { marginBottom: 24 }, sectionTitle: { fontSize: 14, lineHeight: 19, fontWeight: "600", marginBottom: 8 }, rows: { gap: 8 }, row: { minHeight: 74, borderWidth: 1, borderRadius: 13, padding: 11, flexDirection: "row", alignItems: "center", gap: 12 }, thumbnail: { width: 50, height: 50, borderRadius: 9, overflow: "hidden", alignItems: "center", justifyContent: "center" }, rowCopy: { flex: 1, minWidth: 0, gap: 3 }, rowTitle: { fontSize: 14, lineHeight: 19 }, rowMeta: { flexDirection: "row", alignItems: "center", gap: 5 }, metaText: { flex: 1, fontSize: 12, lineHeight: 17 } });

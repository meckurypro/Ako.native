import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";
import { Icon } from "@/components/core/Icon";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/core";
import { FeedPager } from "@/components/feed/FeedPager";
import { useFeedChromeStyle } from "@/components/navigation/FeedChrome";
import { useActiveIdentity } from "@/features/compose/api";
import { usePageNotifications, usePersonalNotifications } from "@/features/notifications/api";
import { useTheme } from "@/providers/ThemeProvider";
import { wordmarks } from "@/theme/wordmarks";

const TABS = ["For You", "Top Discussions", "Following"];
function FeedTabs({ index, onChange }: { index: number; onChange: (index: number) => void }) {
  const { colors } = useTheme(); const { width } = useWindowDimensions(); const tabWidth = (width - 32) / 3;
  return <View style={styles.tabs}>{TABS.map((label, tab) => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: index === tab }} accessibilityLabel={label} onPress={() => onChange(tab)} style={styles.tab}><Text style={[styles.tabLabel, { color: index === tab ? colors.accent : colors.textMuted }]}>{label}</Text></Pressable>)}<View style={[styles.indicator, { width: tabWidth, backgroundColor: colors.accent, transform: [{ translateX: index * tabWidth }] }]} /></View>;
}

export default function HomeScreen() {
  const [feedState, setFeedState] = useState<{ index: number; interest?: string }>(() => ({ index: 0 })); const { colors, isDark } = useTheme(); const router = useRouter(); const { interest } = useLocalSearchParams<{ interest?: string }>(); const insets = useSafeAreaInsets(); const chromeStyle = useFeedChromeStyle(-(insets.top + 109)); const index = feedState.interest === interest ? feedState.index : 0; const setIndex = useCallback((next: number) => setFeedState({ index: next, interest }), [interest]);
  const identity = useActiveIdentity(); const pageId = identity.data?.mode === "page" ? identity.data.page.id : undefined; const personalNotifications = usePersonalNotifications(!pageId); const pageNotifications = usePageNotifications(pageId, !!pageId); const unread = (pageId ? pageNotifications.data : personalNotifications.data)?.filter(item => !item.read_at).length ?? 0;
  return <View style={[styles.root, { backgroundColor: colors.background }]}><FeedPager index={index} onIndexChange={setIndex} interestId={interest} /><Animated.View pointerEvents="box-none" style={[styles.chrome, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top }, chromeStyle]}><View style={styles.top}><Pressable accessibilityLabel="Create" onPress={() => router.push("/modals/create")} style={styles.icon}><Icon name="plus" size={24} color={colors.textMuted} /></Pressable><Image accessibilityLabel="AKọ" source={wordmarks[isDark ? "dark" : "light"]} style={styles.logo} contentFit="contain" /><Pressable accessibilityLabel="Open notifications" onPress={() => router.push("/(tabs)/notifications")} style={styles.icon}><Icon name="bell" size={22} color={colors.textMuted} />{unread > 0 ? <View style={[styles.badge, { backgroundColor: colors.danger }]}><Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text></View> : null}</Pressable></View><FeedTabs index={index} onChange={setIndex} /></Animated.View></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, chrome: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, borderBottomWidth: StyleSheet.hairlineWidth, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, top: { height: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }, icon: { width: 36, height: 36, alignItems: "center", justifyContent: "center" }, logo: { width: 76, height: 36 }, badge: { position: "absolute", right: -3, top: -4, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" }, badgeText: { color: "white", fontSize: 10, lineHeight: 12, fontWeight: "700" }, tabs: { height: 45, flexDirection: "row", paddingHorizontal: 16, position: "relative" }, tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 7 }, tabLabel: { fontSize: 14, fontWeight: "600", lineHeight: 19 }, indicator: { position: "absolute", left: 16, bottom: 0, height: 4, borderRadius: 99 },
});

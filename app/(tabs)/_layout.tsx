import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FeedChromeProvider, useFeedChromeStyle } from "@/components/navigation/FeedChrome";
import { useActiveIdentity } from "@/features/compose/api";
import { useConversations } from "@/features/messaging/api";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

type RouteName = "home" | "discover" | "create" | "inbox" | "profile";
type FeatherIcon = keyof typeof Feather.glyphMap;
const tabs: { route: RouteName; label: string; icon?: FeatherIcon }[] = [
  { route: "home", label: "Feed" }, { route: "discover", label: "Discover", icon: "search" }, { route: "create", label: "Library" }, { route: "inbox", label: "Messages", icon: "message-circle" }, { route: "profile", label: "Profile", icon: "user" },
];

function FeedIcon({ color, active }: { color: string; active: boolean }) {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill={active ? color : "none"} stroke={color} strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 11.5 12 4l9 7.5" /><Path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" /></Svg>;
}

function LibraryIcon({ color, active }: { color: string; active: boolean }) {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill={active ? color : "none"} stroke={color} strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round"><Rect width={8} height={18} x={3} y={3} rx={1} /><Path d="M7 3v18" /><Path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z" /></Svg>;
}

function NavGlyph({ item, color, active }: { item: (typeof tabs)[number]; color: string; active: boolean }) {
  if (item.route === "home") return <FeedIcon color={color} active={active} />;
  if (item.route === "create") return <LibraryIcon color={color} active={active} />;
  return <Feather name={item.icon!} size={24} color={color} strokeWidth={active ? 2 : 1.75} />;
}

function AutoHideTabBar({ state, navigation }: any) {
  const { colors, isDark } = useTheme(); const insets = useSafeAreaInsets(); const bottomInset = Platform.OS === "android" ? Math.max(insets.bottom, 34) : insets.bottom; const chromeStyle = useFeedChromeStyle(86 + bottomInset); const identity = useActiveIdentity(); const conversations = useConversations();
  const pageId = identity.data?.mode === "page" ? identity.data.page.id : undefined;
  const unread = useMemo(() => (conversations.data ?? []).filter(conversation => pageId ? conversation.team_page?.id === pageId : !conversation.team_page).reduce((sum, conversation) => sum + conversation.unreadCount, 0), [conversations.data, pageId]);
  return <Animated.View style={[styles.bar, { borderTopColor: colors.border, paddingBottom: bottomInset + 12 }, chromeStyle]}><BlurView intensity={isDark ? 32 : 44} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /><View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, opacity: 0.8 }]} /><View style={styles.items}>{tabs.map(item => { const routeIndex = state.routes.findIndex((route: { name: string }) => route.name === item.route); const active = state.index === routeIndex; const color = active ? colors.accent : colors.textMuted; return <Pressable key={item.route} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: active }} onPress={() => navigation.navigate(item.route)} style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}><View style={styles.iconWrap}><NavGlyph item={item} color={color} active={active} />{item.route === "inbox" && unread > 0 ? <View style={[styles.badge, { backgroundColor: colors.danger }]}><Animated.Text style={[styles.badgeText, { color: colors.background }]}>{unread > 9 ? "9+" : unread}</Animated.Text></View> : null}</View><Animated.Text style={[styles.label, { color }]}>{item.label}</Animated.Text></Pressable>; })}</View></Animated.View>;
}

export default function TabsLayout() {
  const { session, isReady, onboardingComplete } = useAuth();
  if (!isReady) return null; if (!session) return <Redirect href="/(auth)" />; if (!onboardingComplete) return <Redirect href="/(onboarding)" />;
  return <FeedChromeProvider><Tabs tabBar={props => <AutoHideTabBar {...props} />} screenOptions={{ headerShown: false }}><Tabs.Screen name="home" options={{ title: "Feed" }} /><Tabs.Screen name="discover" options={{ title: "Discover" }} /><Tabs.Screen name="create" options={{ title: "Library" }} /><Tabs.Screen name="inbox" options={{ title: "Messages" }} /><Tabs.Screen name="profile" options={{ title: "Profile" }} /><Tabs.Screen name="notifications" options={{ href: null }} /></Tabs></FeedChromeProvider>;
}

const styles = StyleSheet.create({
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 20, overflow: "hidden", borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 8, paddingTop: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: -1 }, elevation: 4 },
  items: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-around" }, item: { width: 56, alignItems: "center", justifyContent: "center", gap: 4 }, iconWrap: { width: 24, height: 24, position: "relative", alignItems: "center", justifyContent: "center" }, label: { fontSize: 11, lineHeight: 13, fontWeight: "500" }, badge: { position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" }, badgeText: { fontSize: 10, lineHeight: 12, fontWeight: "500" },
});

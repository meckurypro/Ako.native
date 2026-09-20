// File: components/BottomNav.tsx
//
// Mounted once in app/_layout.tsx (web renders it per page — see
// lib/bottomNavRoutes.ts for which routes show it). Fixed to the bottom,
// rounded-t-[28px], translucent + blurred, slides off the bottom edge on
// scroll-down and back on scroll-up (hooks/useAutoHideOnScroll).
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Search, LibraryBig, MessageCircle, User } from "lucide-react-native";
import { useAuth } from "../hooks/useAuth";
import { useAutoHideOnScroll } from "../hooks/useAutoHideOnScroll";
import { useUnreadConversationCount } from "../hooks/useMessaging";
import { usePageInboxUnreadCount } from "../hooks/usePageInbox";
import { useActiveIdentity } from "../hooks/usePages";
import { shouldShowBottomNav } from "../lib/bottomNavRoutes";
import { useTheme, withAlpha } from "../lib/theme";

type IconProps = { size?: number; strokeWidth?: number; fill?: string; color?: string };

// Same roof-and-frame silhouette as web (Lucide's Home draws a door line
// that reads badly when filled).
function FeedIcon({ size = 24, strokeWidth = 1.75, fill = "none", color = "#000000" }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M3 11.5 12 4l9 7.5" />
      <Path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" />
    </Svg>
  );
}

// CSS `ease-out` == cubic-bezier(0, 0, 0.58, 1)
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

function isWithin(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(base + "/");
}

interface NavItemProps {
  icon: ComponentType<IconProps>;
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: number;
}

function NavItem({ icon: Icon, label, active, onPress, badge = 0 }: NavItemProps) {
  const { colors } = useTheme();
  const color = active ? colors.accent : colors.inkMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={styles.item}
    >
      <View>
        <Icon
          size={24}
          strokeWidth={active ? 2 : 1.75}
          color={color}
          fill={active ? color : "none"}
        />
        {badge > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.danger }]}>
            <Text style={[styles.badgeText, { color: colors.canvas }]}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const visible = useAutoHideOnScroll();
  const { user, profile } = useAuth();
  const { data: identity } = useActiveIdentity();
  const activePageId = identity?.mode === "page" ? identity.page.id : undefined;
  const personalUnread = useUnreadConversationCount();
  const pageUnread = usePageInboxUnreadCount(activePageId);
  const unreadCount = activePageId ? pageUnread : personalUnread;

  const [height, setHeight] = useState(0);
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 300,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  }, [visible, progress]);

  if (!shouldShowBottomNav(pathname)) return null;

  // Own-profile tab is only active on OUR profile (or the page we're
  // currently acting as) — never on someone else's. "/me" is the native
  // placeholder for web's /me redirect.
  const pageUsername = identity?.mode === "page" ? identity.page.username : undefined;
  const isOwnProfileActive =
    pathname === "/me" ||
    (!!profile?.username && isWithin(pathname, `/profile/${profile.username}`)) ||
    (!!pageUsername && isWithin(pathname, `/page/${pageUsername}`));

  // Messages lights up on /messages/*, /page-inbox/* (page mode), and the
  // native /inbox placeholder.
  const isMessagesActive =
    isWithin(pathname, "/messages") || isWithin(pathname, "/page-inbox") || pathname === "/inbox";

  // Same as web's NavLink `replace`: tab switches don't stack history.
  const go = (to: string) => router.replace(to as any);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  return (
    <Animated.View
      onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}
      style={[
        styles.shell,
        {
          opacity: progress,
          transform: [{ translateY }],
          shadowColor: isDark ? "#000000" : "#1F1D1A",
        },
      ]}
    >
      <View style={[styles.surface, { borderTopColor: colors.border }]}>
        {/* bg-surface/80 + backdrop-blur-md */}
        <BlurView
          intensity={40}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(colors.surface, 0.8) }]}
        />
        <View style={[styles.row, { paddingBottom: insets.bottom + 12 }]}>
          <NavItem
            icon={FeedIcon}
            label="Feed"
            active={isWithin(pathname, "/feed")}
            onPress={() => go("/feed")}
          />
          <NavItem
            icon={Search}
            label="Discover"
            active={isWithin(pathname, "/topics")}
            onPress={() => go("/topics")}
          />
          <NavItem
            icon={LibraryBig}
            label="Library"
            active={isWithin(pathname, "/library")}
            onPress={() => go("/library")}
          />
          <NavItem
            icon={MessageCircle}
            label="Messages"
            active={isMessagesActive}
            onPress={() => go("/inbox")}
            badge={unreadCount}
          />
          <NavItem
            icon={User}
            label="Profile"
            active={isOwnProfileActive}
            onPress={() => go(user ? "/me" : "/login")}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // fixed bottom-0 left-0 right-0 z-40 — shadow lives here, on a view
  // WITHOUT overflow:hidden, or iOS clips it.
  shell: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    elevation: 40,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    // web: 0 -1px 3px rgba(ink, 0.06)
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 1.5,
  },
  // rounded-t-[28px] border-t + clips the blur to the rounded corners
  surface: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    overflow: "hidden",
  },
  // px-2 pt-3 (pb = safe-area + 12 applied inline) / flex justify-around
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  // flex-col items-center gap-1 w-14
  item: { width: 56, alignItems: "center", gap: 4 },
  // text-[11px] font-medium
  label: { fontSize: 11, fontWeight: "500", lineHeight: 16 },
  // absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-medium
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "500", lineHeight: 12 },
});

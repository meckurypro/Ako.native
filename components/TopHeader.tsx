// File: components/TopHeader.tsx
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Bell, Plus } from "lucide-react-native";
import { Wordmark } from "./Wordmark";
import { Avatar } from "./Avatar";
import { useUnreadCount } from "../hooks/useNotifications";
import { useMyProfile } from "../hooks/useProfile";
import { useTheme } from "../lib/theme";

interface TopHeaderProps {
  // Feed passes "create" — a "+" that opens /create in place of the
  // own-avatar link. Every other caller (Discover) keeps the avatar.
  leftAction?: "avatar" | "create";
}

// Own avatar (or "+" on Feed) on the left, icon mark centered, bell on the
// right. No shadow here — like web, the shadow belongs to the AutoHideTopBar
// wrapper that holds this together with any tabs row below it.
export function TopHeader({ leftAction = "avatar" }: TopHeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const unreadCount = useUnreadCount();
  const { data: me } = useMyProfile();

  return (
    <View style={styles.header}>
      {leftAction === "create" ? (
        <Pressable
          onPress={() => router.push("/create" as any)}
          accessibilityRole="button"
          accessibilityLabel="Create"
          style={styles.createButton}
        >
          <Plus size={24} strokeWidth={2} color={colors.inkMuted} />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push((me ? `/profile/${me.username}` : "/me") as any)}
          accessibilityRole="button"
          accessibilityLabel="Your profile"
        >
          <Avatar src={me?.avatar_url} name={me?.display_name ?? "You"} size="sm" />
        </Pressable>
      )}

      <Wordmark size="sm" />

      <Pressable
        onPress={() => router.push("/notifications" as any)}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        hitSlop={8}
      >
        <Bell size={22} color={colors.inkMuted} />
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.danger }]}>
            <Text style={[styles.badgeText, { color: colors.canvas }]}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // px-4 pt-5 pb-2
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // w-9 h-9 -ml-1.5 rounded-full
  createButton: {
    width: 36,
    height: 36,
    marginLeft: -6,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  // -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] font-medium
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "500", lineHeight: 12 },
});

// File: components/PostCollaboratorsBadge.tsx
//
// Sits on the corner of a post/project's avatar (the parent needs to be
// `position: relative` — PostCard's avatar Pressable is) — only ACCEPTED
// collaborators count (an outstanding invite isn't "posted with" anyone yet),
// so this renders nothing until at least one has accepted. Tapping it opens a
// small anchored menu of everyone credited, each row going to their profile.
//
// Native differences: web's hand-positioned fixed dropdown is the shared
// <DropdownMenu> (anchored via measureInWindow), with each collaborator's
// avatar as the row icon. DropdownMenu has no header slot, so web's "Posted
// with" caption is carried by the badge's accessibility label instead.
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Users } from "lucide-react-native";
import { Avatar } from "./Avatar";
import { DropdownMenu, type DropdownMenuItem } from "./DropdownMenu";
import { useCollaborators, type CollaborationTarget } from "../hooks/useCollaboration";
import { useTheme } from "../lib/theme";

export function PostCollaboratorsBadge({ target, targetId }: { target: CollaborationTarget; targetId: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: collaborators } = useCollaborators(target, targetId);
  const accepted = (collaborators ?? []).filter((c) => c.status === "accepted");
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<View>(null);

  if (accepted.length === 0) return null;

  const items: DropdownMenuItem[] = accepted.map((c) => ({
    key: c.user.id,
    label: c.user.display_name,
    icon: <Avatar src={c.user.avatar_url} name={c.user.display_name} size="sm" />,
    onSelect: () => router.push(`/profile/${c.user.username}` as any),
  }));

  return (
    <>
      {/* web: absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent text-canvas border-2 border-surface */}
      <Pressable
        ref={anchorRef}
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Posted with ${accepted.length} ${accepted.length === 1 ? "collaborator" : "collaborators"}`}
        style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.surface }]}
      >
        <Users size={11} strokeWidth={2.5} color={colors.canvas} />
      </Pressable>

      {open && <DropdownMenu anchorRef={anchorRef} items={items} onClose={() => setOpen(false)} />}
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});

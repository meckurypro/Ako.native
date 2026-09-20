// File: components/MentionLink.tsx
// Port of web's src/components/MentionLink.tsx.
//
// Renders an @mention as a tappable link to the right place —
// /profile/:username for a personal account, /page/:username for an
// organization/brand page. Used by lib/formatText.tsx wherever an
// @token is parsed out of post/project/comment/bio text.
//
// Starts pointed at /profile/:username (the default useAccountKind
// resolves to before/without an answer) and corrects itself to
// /page/:username if the lookup comes back a page — no loading state
// needed since the wrong-for-a-moment link is never tapped before the
// (cached, usually-instant) resolution lands.
//
// Web uses react-router-dom's <Link>, which stops propagation itself
// via onClick. RN's inline-text equivalent is a nested <Text
// onPress={...}> — Text is the only RN primitive that can sit inline
// inside another Text's flow — and RN's touch responder system already
// resolves a tap to whichever nested Text/Pressable is deepest, so no
// explicit stopPropagation call is needed here.
//
// Neither /profile/[username] nor /page/[username] exist yet — this
// pushes to the same routes web uses; wire-up is verified once those
// screens are ported.
import type { ReactNode } from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import { useAccountKind } from "../hooks/useAccountKind";
import { useTheme } from "../lib/theme";

interface MentionLinkProps {
  username: string;
  children: ReactNode;
}

export function MentionLink({ username, children }: MentionLinkProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: kind } = useAccountKind(username);

  function handlePress() {
    const path = kind === "page" ? `/page/${username}` : `/profile/${username}`;
    router.push(path as any);
  }

  return (
    <Text onPress={handlePress} style={{ color: colors.accent }}>
      {children}
    </Text>
  );
}

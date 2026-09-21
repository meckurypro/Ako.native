// File: components/FollowButton.tsx
//
// Port of web's src/components/FollowButton.tsx — the small pill in a post
// card's top-right corner. One-directional on purpose: it only ever moves you
// forward (not following → following / requested), never offers to unfollow —
// a stray tap on a compact card control shouldn't drop a follow — so once
// you're following (or a request is pending) it renders as a plain
// non-interactive label. Managing a follow lives on the profile screen.
// PostCard is responsible for not rendering it on your own posts.
//
// Uses the active-identity-aware follow hooks, same as web, so this pill and
// the profile screen's Follow button always agree on whether the acting
// identity (person or page) follows this account. Private-account follow
// requests are still person-only, as on web (flagged there as a follow-up).
//
// Native differences: Tailwind pills → StyleSheet (text-[11px] font-semibold
// px-2.5 py-1 rounded-full; bg-ink/10 text-ink, or bg-pushback/15
// text-pushback for "follow back"); the `.ako-pill-in` CSS keyframe (260ms,
// scale .85 → 1.05 → 1, opacity 0 → 1, cubic-bezier(.34,1.56,.64,1)) becomes
// two Animated segments; web's e.preventDefault/stopPropagation isn't needed —
// an inner Pressable already swallows the touch; hitSlop is added since the
// pill itself is under the 44dp touch target.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text } from "react-native";
import {
  useIsFollowingAsActiveIdentity,
  useIsFollowedByUser,
  useToggleFollowAsActiveIdentity,
} from "../hooks/useProfile";
import { useHasPendingFollowRequest, useSendFollowRequest } from "../hooks/useFollowRequests";
import { useTheme, withAlpha } from "../lib/theme";

interface FollowButtonProps {
  authorId: string;
  isPrivate: boolean;
}

const PILL_EASING = Easing.bezier(0.34, 1.56, 0.64, 1);

// The brief scale+fade "arrival" — played on the pill the instant it first
// appears (0% → 60% grow + fade in, 60% → 100% settle), never on an ordinary
// re-render.
function usePillIn(play: boolean) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!play) return;
    scale.setValue(0.85);
    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.05, duration: 156, easing: PILL_EASING, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 156, easing: PILL_EASING, useNativeDriver: true }),
      ]),
      Animated.timing(scale, { toValue: 1, duration: 104, easing: PILL_EASING, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [play, scale, opacity]);

  return { transform: [{ scale }], opacity };
}

function StatusPill({ children, justArrived }: { children: ReactNode; justArrived: boolean }) {
  const { colors } = useTheme();
  const motion = usePillIn(justArrived);
  return (
    <Animated.View style={[styles.pill, { backgroundColor: withAlpha(colors.ink, 0.1) }, motion]}>
      <Text style={[styles.pillText, { color: colors.ink }]}>{children}</Text>
    </Animated.View>
  );
}

export function FollowButton({ authorId, isPrivate }: FollowButtonProps) {
  const { colors } = useTheme();
  const isFollowingQuery = useIsFollowingAsActiveIdentity(authorId);
  const isFollowedByUserQuery = useIsFollowedByUser(authorId);
  const hasPendingQuery = useHasPendingFollowRequest(authorId);
  const toggleFollow = useToggleFollowAsActiveIdentity(authorId);
  const sendRequest = useSendFollowRequest(authorId);

  const isFollowing = !!isFollowingQuery.data;
  const isFollowedByUser = !!isFollowedByUserQuery.data;
  const hasPendingRequest = !!hasPendingQuery.data;
  const loading =
    isFollowingQuery.isLoading || isFollowedByUserQuery.isLoading || hasPendingQuery.isLoading;

  // prevEstablished starts wherever the data actually is on first load, so an
  // already-established relationship never animates on mount.
  const [justArrived, setJustArrived] = useState(false);
  const prevEstablished = useRef<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    const established = isFollowing || hasPendingRequest;
    if (prevEstablished.current !== null && established && !prevEstablished.current) {
      setJustArrived(true);
      const timer = setTimeout(() => setJustArrived(false), 280);
      prevEstablished.current = established;
      return () => clearTimeout(timer);
    }
    prevEstablished.current = established;
  }, [loading, isFollowing, hasPendingRequest]);

  // Wait for the relationship checks — avoids a flash of "Follow" on someone
  // you already follow while the queries load.
  if (loading) return null;

  if (isFollowing) {
    return <StatusPill justArrived={justArrived}>{isFollowedByUser ? "Friends" : "Following"}</StatusPill>;
  }

  if (hasPendingRequest) {
    return <StatusPill justArrived={justArrived}>Requested</StatusPill>;
  }

  function handlePress() {
    if (isPrivate) {
      sendRequest.mutate();
    } else {
      toggleFollow.mutate(false);
    }
  }

  // Plain follow: neutral (ink/10). They already follow you: same shape in the
  // pushback ochre (pushback/15 fill, solid text). accessibilityLabel keeps the
  // "Follow back" distinction even though both read "Follow".
  const backgroundColor = withAlpha(isFollowedByUser ? colors.pushback : colors.ink, isFollowedByUser ? 0.15 : 0.1);
  const textColor = isFollowedByUser ? colors.pushback : colors.ink;
  const disabled = toggleFollow.isPending || sendRequest.isPending;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isFollowedByUser ? "Follow back" : "Follow"}
      style={[styles.pill, { backgroundColor }, disabled && styles.disabled]}
    >
      <Text style={[styles.pillText, { color: textColor }]}>Follow</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }, // px-2.5 py-1 rounded-full
  pillText: { fontSize: 11, fontWeight: "600" }, // text-[11px] font-semibold
  disabled: { opacity: 0.5 },
});

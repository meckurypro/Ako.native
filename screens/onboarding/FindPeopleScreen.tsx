// File: screens/onboarding/FindPeopleScreen.tsx
// (routed to via app/onboarding/people.tsx)
//
// Port of web's pages/onboarding/FindPeople.tsx — a short (max 5),
// interest-matched list from get_onboarding_recommendations with Follow
// toggles, then Continue.
//
// Native differences worth knowing:
//   - Web tallies the "Continue · N following" label by sniffing clicks on
//     any <button> inside the list (onClickCapture). Here each row reports
//     back through an onToggled callback once its follow/unfollow actually
//     succeeds, so a failed toggle never bumps the count.
//   - Web's follow sound (useSound) isn't ported yet.
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnboardingRecommendations, type OnboardingRecommendation } from "../../hooks/useOnboarding";
import { useIsFollowing, useToggleFollow } from "../../hooks/useProfile";
import { Avatar } from "../../components/Avatar";
import { Wordmark } from "../../components/Wordmark";
import { Button } from "../../components/Button";
import { AuthPattern } from "../../components/AuthPattern";
import { useTheme } from "../../lib/theme";
import { OnboardingStepGuard } from "./OnboardingStepGuard";

// Never more than five picks — this is meant to read as a short,
// hand-curated shortlist rather than an open-ended directory. Passed
// straight through as the RPC's own p_limit, so only five ever come
// back over the wire.
const MAX_SUGGESTIONS = 5;

// Onboarding always runs in Personal mode (a brand-new account has no
// pages yet, and there's no path to switch identity before this gate
// clears) — so the plain, always-personal useToggleFollow is correct
// here, not the page-identity-aware variant FollowButton uses elsewhere.
function SuggestedPersonRow({
  person,
  onToggled,
}: {
  person: OnboardingRecommendation;
  onToggled: (wasFollowing: boolean) => void;
}) {
  const { colors } = useTheme();
  const isFollowingQuery = useIsFollowing(person.id);
  const toggleFollow = useToggleFollow(person.id);
  const isFollowing = !!isFollowingQuery.data;

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.ink },
      ]}
    >
      <Avatar src={person.avatar_url} name={person.display_name} size="md" />

      <View style={styles.rowBody}>
        <View style={styles.nameRow}>
          {/* font-display (Playfair Display) — not a loaded RN font yet. */}
          <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
            {person.display_name}
          </Text>
          {person.is_admin_suggested && (
            <View style={[styles.featured, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.featuredText, { color: colors.accent }]}>Featured</Text>
            </View>
          )}
        </View>
        <Text style={[styles.meta, { color: colors.inkMuted }]} numberOfLines={1}>
          @{person.username}
          {person.follower_count > 0 && ` · ${person.follower_count.toLocaleString()} followers`}
        </Text>

        {!!person.bio && (
          <Text style={[styles.bio, { color: colors.inkMuted }]} numberOfLines={1}>
            {person.bio}
          </Text>
        )}

        {person.shared_interest_count > 0 && (
          <Text style={[styles.shared, { color: colors.accent }]}>
            {person.shared_interest_count} shared interest{person.shared_interest_count > 1 ? "s" : ""}
          </Text>
        )}
      </View>

      <Button
        variant={isFollowing ? "secondary" : "primary"}
        size="sm"
        onPress={() => toggleFollow.mutate(isFollowing, { onSuccess: () => onToggled(isFollowing) })}
        disabled={isFollowingQuery.isLoading}
        loading={toggleFollow.isPending}
      >
        {isFollowing ? "Following" : "Follow"}
      </Button>
    </View>
  );
}

export function FindPeopleScreen() {
  return (
    <OnboardingStepGuard>
      <FindPeople />
    </OnboardingStepGuard>
  );
}

function FindPeople() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: recommendations, isLoading, error, refetch } = useOnboardingRecommendations(MAX_SUGGESTIONS);
  const [followedCount, setFollowedCount] = useState(0);

  // Local-only tally for the "Continue · N following" copy — actual
  // follow state lives server-side per card via useIsFollowing, this
  // is just a friendlier button label.
  function handleFollowToggled(wasFollowing: boolean) {
    setFollowedCount((n) => Math.max(0, n + (wasFollowing ? -1 : 1)));
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <AuthPattern />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 24, paddingBottom: 24 }}
        >
          <View style={styles.column}>
            <View style={styles.wordmarkWrap}>
              <Wordmark />
            </View>

            <Text style={[styles.title, { color: colors.ink }]}>Find your people</Text>
            <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
              A short, hand-picked list based on what you're interested in — people you might enjoy reasoning
              with.
            </Text>

            {isLoading ? (
              <Text style={[styles.status, { color: colors.inkMuted }]}>Finding people for you…</Text>
            ) : error ? (
              <View style={styles.statusBlock}>
                <Text style={{ color: colors.danger, marginBottom: 16, fontSize: 16 }}>
                  Couldn't load suggestions.
                </Text>
                <Pressable onPress={() => refetch()} accessibilityRole="button">
                  <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "500" }}>Try again</Text>
                </Pressable>
              </View>
            ) : !recommendations || recommendations.length === 0 ? (
              // No/few matches (spec §16) — never a dead-end screen, still
              // fully continuable.
              <Text style={[styles.status, { color: colors.inkMuted, fontSize: 14 }]}>
                We couldn't find anyone to suggest just yet — you can always find people to follow from Discover
                once you're in.
              </Text>
            ) : (
              <View style={styles.list}>
                {recommendations.slice(0, MAX_SUGGESTIONS).map((person) => (
                  <SuggestedPersonRow key={person.id} person={person} onToggled={handleFollowToggled} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        <View
          style={[
            styles.bar,
            { backgroundColor: colors.canvas, borderTopColor: colors.border, paddingBottom: 16 + insets.bottom },
          ]}
        >
          <View style={styles.barInner}>
            <View style={styles.barButton}>
              <Button onPress={() => router.push("/onboarding/building")}>
                {followedCount > 0 ? `Continue · ${followedCount} following` : "Continue"}
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, overflow: "hidden" },
  // web: max-w-lg mx-auto
  column: { width: "100%", maxWidth: 512, alignSelf: "center" },
  wordmarkWrap: { marginBottom: 32 },
  title: { fontSize: 24, lineHeight: 32, marginBottom: 8 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 32 },

  // web: py-16 centered text
  status: { textAlign: "center", paddingVertical: 64, fontSize: 16 },
  statusBlock: { alignItems: "center", paddingVertical: 64 },

  list: { gap: 12 },
  // web: rounded-xl border px-3.5 py-3 flex gap-3 shadow-[0_1px_4px_-1px rgba(ink,0.06)]
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  rowBody: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 14, flexShrink: 1 },
  featured: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  featuredText: { fontSize: 10, fontWeight: "500" },
  meta: { fontSize: 12, marginTop: 2 },
  bio: { fontSize: 12, marginTop: 4 },
  shared: { fontSize: 11, fontWeight: "500", marginTop: 4 },

  // web: px-6 py-4 border-t, max-w-lg row justify-end, w-48 button
  bar: { borderTopWidth: 1, paddingHorizontal: 24, paddingTop: 16 },
  barInner: { width: "100%", maxWidth: 512, alignSelf: "center", alignItems: "flex-end" },
  barButton: { width: 192 },
});

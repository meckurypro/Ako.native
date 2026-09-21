// File: screens/onboarding/InterestPickerScreen.tsx
// (routed to via app/onboarding/interests.tsx)
//
// Port of web's pages/onboarding/InterestPicker.tsx — same typeahead-with-
// chips picker, same 3-topic minimum, same resume-prefill and diffed save.
//
// Native differences worth knowing:
//   - Web floats the suggestion list over the page (absolute). Here it's
//     laid out inline directly under the field: an absolutely-positioned
//     child that overflows its parent inside a ScrollView isn't tappable on
//     Android, and nothing sits below the field on this screen, so it reads
//     the same.
//   - Web's fixed bottom bar becomes a flex sibling under the ScrollView,
//     inside a KeyboardAvoidingView, so it rides above the keyboard rather
//     than being covered by it.
//   - web's onMouseDown-before-blur trick is replaced by
//     keyboardShouldPersistTaps="handled" (a tap on a suggestion doesn't
//     blur the field or dismiss the keyboard).
//   - Backspace-on-empty pops the last chip via onKeyPress. Some Android
//     soft keyboards don't emit that key event for an empty field — chips
//     can still always be removed with their ✕.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, X } from "lucide-react-native";
import { useCategories } from "../../hooks/useCategories";
import { useMyInterestIds, useSaveInterests } from "../../hooks/useOnboarding";
import { Wordmark } from "../../components/Wordmark";
import { Button } from "../../components/Button";
import { AuthPattern } from "../../components/AuthPattern";
import { useTheme, withAlpha } from "../../lib/theme";
import { OnboardingStepGuard } from "./OnboardingStepGuard";

const MIN_INTERESTS = 3;
const MAX_SUGGESTIONS = 8;

export function InterestPickerScreen() {
  return (
    <OnboardingStepGuard>
      <InterestPicker />
    </OnboardingStepGuard>
  );
}

function InterestPicker() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: categories, isLoading, error } = useCategories();
  const { data: existingInterestIds, isLoading: existingLoading } = useMyInterestIds();
  const saveInterests = useSaveInterests();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const prefilled = useRef(false);

  // Flat, searchable list of every interest across every category —
  // this is what powers the typeahead, so a match on "startups" finds
  // it regardless of which category it lives under.
  const flatInterests = useMemo(
    () =>
      (categories ?? []).flatMap((category) =>
        category.interests.map((interest) => ({ ...interest, categoryName: category.name }))
      ),
    [categories]
  );

  // Preserves selection order (Set iterates in insertion order) so
  // chips don't jump around as you add/remove them.
  const selectedInterests = useMemo(
    () => Array.from(selected).flatMap((id) => flatInterests.filter((i) => i.id === id)),
    [selected, flatInterests]
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return flatInterests
      .filter((i) => !selected.has(i.id) && i.name.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS);
  }, [query, flatInterests, selected]);

  // Seed selections from whatever's already saved (resume case) —
  // once only, so it doesn't clobber the user's in-progress toggling
  // on a background refetch.
  useEffect(() => {
    if (prefilled.current || !existingInterestIds) return;
    if (existingInterestIds.length > 0) {
      setSelected(new Set(existingInterestIds));
    }
    prefilled.current = true;
  }, [existingInterestIds]);

  function toggleInterest(interestId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(interestId)) {
        next.delete(interestId);
      } else {
        next.add(interestId);
      }
      return next;
    });
  }

  function selectSuggestion(interestId: string) {
    toggleInterest(interestId);
    setQuery("");
    inputRef.current?.focus();
  }

  // Backspace on an empty field pops the most recently added chip —
  // mirrors the FB/Instagram tag-input pattern.
  function handleKeyPress(e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (e.nativeEvent.key === "Backspace" && query === "" && selectedInterests.length > 0) {
      toggleInterest(selectedInterests[selectedInterests.length - 1].id);
    }
  }

  async function handleContinue() {
    if (selected.size < MIN_INTERESTS) return;
    setSaveError(null);

    try {
      await saveInterests.mutateAsync(Array.from(selected));
      router.push("/onboarding/people");
    } catch (err) {
      console.error("Failed to save interests:", err);
      setSaveError("Couldn't save your interests. Check your connection and try again.");
    }
  }

  if (isLoading || existingLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <AuthPattern />
        <Text style={{ color: colors.inkMuted, fontSize: 16 }}>Loading topics…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas, paddingHorizontal: 24 }]}>
        <AuthPattern />
        <Text style={{ color: colors.danger, fontSize: 16, textAlign: "center" }}>
          Couldn't load topics. Check your connection and try again.
        </Text>
      </View>
    );
  }

  const canContinue = selected.size >= MIN_INTERESTS;

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <AuthPattern />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 24, paddingBottom: 24 }}
        >
          <View style={styles.column}>
            <View style={styles.wordmarkWrap}>
              <Wordmark />
            </View>

            {/* font-display (Playfair Display) — not a loaded RN font yet. */}
            <Text style={[styles.title, { color: colors.ink }]}>What do you reason about?</Text>
            <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
              Pick at least {MIN_INTERESTS} topics. We'll use them to help you find relevant people and shape your
              Akọ — you can change it anytime.
            </Text>

            {!!saveError && (
              <Text accessibilityRole="alert" style={[styles.saveError, { color: colors.danger }]}>
                {saveError}
              </Text>
            )}

            {/* Tag-input field: search icon + chips + the text input, wrapping. */}
            <Pressable
              onPress={() => inputRef.current?.focus()}
              style={[
                styles.field,
                {
                  backgroundColor: colors.surface,
                  borderColor: isFocused ? withAlpha(colors.accent, 0.6) : colors.border,
                },
              ]}
            >
              <Search size={16} color={colors.inkMuted} style={styles.searchIcon} />

              {selectedInterests.map((interest) => (
                <View key={interest.id} style={[styles.chip, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.chipText, { color: colors.canvas }]}>{interest.name}</Text>
                  <Pressable
                    onPress={() => toggleInterest(interest.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${interest.name}`}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.chipRemove,
                      pressed && { backgroundColor: withAlpha(colors.canvas, 0.2) },
                    ]}
                  >
                    <X size={11} color={colors.canvas} />
                  </Pressable>
                </View>
              ))}

              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                onKeyPress={handleKeyPress}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={selectedInterests.length === 0 ? "Search topics — Music, Startups, Fitness…" : "Add more…"}
                placeholderTextColor={withAlpha(colors.inkMuted, 0.6)}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                style={[styles.input, { color: colors.ink }]}
              />
            </Pressable>

            {isFocused && query.trim().length > 0 && (
              <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {suggestions.length === 0 ? (
                  <Text style={[styles.noMatch, { color: colors.inkMuted }]}>
                    No topics match "{query.trim()}"
                  </Text>
                ) : (
                  suggestions.map((interest) => (
                    <Pressable
                      key={interest.id}
                      onPress={() => selectSuggestion(interest.id)}
                      style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.canvas }]}
                    >
                      <Text style={[styles.suggestionName, { color: colors.ink }]}>{interest.name}</Text>
                      <Text style={[styles.suggestionCategory, { color: colors.inkMuted }]}>
                        {interest.categoryName}
                      </Text>
                    </Pressable>
                  ))
                )}
                </ScrollView>
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
            <Text style={[styles.barCount, { color: colors.inkMuted }]}>
              {selected.size} selected
              {selected.size < MIN_INTERESTS && ` (${MIN_INTERESTS} minimum)`}
            </Text>
            <View style={styles.barButton}>
              <Button onPress={handleContinue} disabled={!canContinue} loading={saveInterests.isPending}>
                Continue
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  // web: max-w-2xl mx-auto
  column: { width: "100%", maxWidth: 672, alignSelf: "center" },
  wordmarkWrap: { marginBottom: 32 },
  title: { fontSize: 24, lineHeight: 32, marginBottom: 8 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 32 },
  saveError: { fontSize: 14, marginBottom: 16 },

  // web: min-h-[52px] flex-wrap gap-1.5 rounded-2xl border px-3 py-2
  field: {
    minHeight: 52,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: { marginLeft: 4 },
  // web: pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, fontWeight: "500" },
  chipRemove: { borderRadius: 999, padding: 2 },
  // web: flex-1 min-w-[120px] text-sm py-1
  input: { flexGrow: 1, flexShrink: 1, minWidth: 120, fontSize: 14, paddingVertical: 4 },

  // web: mt-2 rounded-2xl border shadow-lg max-h-64
  dropdown: { marginTop: 8, borderWidth: 1, borderRadius: 16, maxHeight: 256, overflow: "hidden" },
  noMatch: { fontSize: 14, paddingHorizontal: 16, paddingVertical: 12 },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  suggestionName: { fontSize: 14 },
  suggestionCategory: { fontSize: 12 },

  // web: px-6 py-4 border-t, max-w-2xl row, w-40 button
  bar: { borderTopWidth: 1, paddingHorizontal: 24, paddingTop: 16 },
  barInner: {
    width: "100%",
    maxWidth: 672,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  barCount: { fontSize: 14, flexShrink: 1 },
  barButton: { width: 160 },
});

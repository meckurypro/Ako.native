import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Icon } from "@/components/core/Icon";
import * as ImagePicker from "expo-image-picker";
import { ensurePermission } from "@/lib/permissions";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Text } from "@/components/core";
import { HeadingColorPicker } from "@/components/compose/HeadingColorPicker";
import { useCategories } from "@/features/onboarding/api";
import { useActiveIdentity, useCreatePost, useUploadPostMedia } from "@/features/compose/api";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { ProbationalLock } from "@/components/account/ProbationalLock";

const CONTENT_LIMIT = 450;
const HEADING_LIMIT = 50;
const MAX_MEDIA = 4;
const MAX_TOPICS = 5;

const FORMAT_ACTIONS = [
  { icon: "bold", label: "Bold" },
  { icon: "italic", label: "Italic" },
  { icon: "strikethrough", label: "Strikethrough" },
  { icon: "underline", label: "Underline" },
] as const;

export default function Compose() {
  return <ProbationalLock featureKey="probational_post_enabled"><ComposeScreen /></ProbationalLock>;
}

function ComposeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const identity = useActiveIdentity();
  const categories = useCategories();
  const create = useCreatePost();
  const upload = useUploadPostMedia();
  const [heading, setHeading] = useState("");
  const [headingColor, setHeadingColor] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [media, setMedia] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const postingAsPage = identity.data?.mode === "page" ? identity.data.page : null;
  const displayName = postingAsPage?.name ?? profile?.display_name ?? "You";
  const avatarUrl = postingAsPage?.avatar_url ?? profile?.avatar_url;
  const dirty = !!heading || !!content || !!media.length || !!topics.size;
  const canSubmit = !!heading.trim() || !!content.trim();

  const submit = async (status?: "draft") => {
    if (!canSubmit) return;
    setError(null);
    try {
      const post = await create.mutateAsync({
        heading: heading.trim() || undefined,
        heading_color: headingColor,
        content,
        interest_ids: [...topics],
        media_urls: media,
        ...(status ? { status } : {}),
        ...(postingAsPage ? { posted_as_page_id: postingAsPage.id } : {}),
      });
      if (status) Alert.alert("Draft saved", "Your post is available in your drafts.");
      router.replace(status ? "/(tabs)/home" : { pathname: "/posts/[postId]", params: { postId: post.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't publish this post.");
    }
  };

  const close = () => {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert("Keep this post?", "Save it as a draft or discard your changes.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Save draft", onPress: () => void submit("draft") },
      { text: "Discard", style: "destructive", onPress: () => router.back() },
    ]);
  };

  const pick = async () => {
    if (media.length >= MAX_MEDIA) return;
    const granted = await ensurePermission("mediaLibrary");
    if (!granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIA - media.length,
      quality: 0.85,
    });
    if (result.canceled) return;
    for (const asset of result.assets) {
      try {
        const url = await upload.mutateAsync(asset);
        setMedia((previous) => [...previous, url]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
        break;
      }
    }
  };

  const toggleTopic = (id: string) => setTopics((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else if (next.size < MAX_TOPICS) next.add(id);
    return next;
  });

  const showMore = () => Alert.alert("Post options", undefined, [
    { text: "Save as draft", onPress: () => void submit("draft") },
    { text: "Cancel", style: "cancel" },
  ]);

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.identity}>
            <Avatar uri={avatarUrl} name={displayName} size={32} />
            <Text style={styles.identityText} color="muted">
              Posting as <Text style={styles.identityName}>{displayName}</Text>
              {!postingAsPage && <Text color="accent" onPress={() => router.push("/pages" as never)}> · switch</Text>}
            </Text>
          </View>

          <View style={styles.headingRow}>
            <TextInput
              value={heading}
              onChangeText={(value) => setHeading(value.slice(0, HEADING_LIMIT))}
              maxLength={HEADING_LIMIT}
              placeholder="Heading (optional)"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.accent}
              style={[styles.headingInput, { color: colors.text, flex: 1 }]}
            />
            <HeadingColorPicker value={headingColor} onChange={setHeadingColor} isDark={isDark} />
          </View>
          <Text variant="caption" color="muted" style={styles.headingCount}>{heading.length}/{HEADING_LIMIT}</Text>

          <View style={styles.formatBar}>
            {FORMAT_ACTIONS.map((action) => (
              <Pressable key={action.label} accessibilityLabel={action.label} hitSlop={8} style={styles.formatButton}>
                <Icon name={action.icon} size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>

          <TextInput
            value={content}
            onChangeText={(value) => setContent(value.slice(0, CONTENT_LIMIT))}
            maxLength={CONTENT_LIMIT}
            multiline
            textAlignVertical="top"
            placeholder="Add details… use @ to mention someone."
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accent}
            style={[styles.bodyInput, { color: colors.text }]}
          />

          {!!media.length && (
            <View style={styles.mediaGrid}>
              {media.map((url) => (
                <View key={url} style={[styles.mediaItem, { backgroundColor: colors.surface }]}>
                  <Image source={{ uri: url }} style={styles.mediaImage} />
                  <Pressable accessibilityLabel="Remove attachment" onPress={() => setMedia((items) => items.filter((item) => item !== url))} style={styles.removeMedia}>
                    <Icon name="x" size={15} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {!postingAsPage && (
            <Pressable onPress={() => Alert.alert("Tag a project", "Project tagging is not available in the mobile app yet.")} style={styles.inlineAction}>
              <Icon name="link-2" size={16} color={colors.accent} />
              <Text style={styles.actionText} color="accent">Tag a project</Text>
            </Pressable>
          )}

          <View style={styles.attachmentRow}>
            <Pressable disabled={upload.isPending || media.length >= MAX_MEDIA} onPress={() => void pick()} style={styles.inlineAction}>
              <Icon name="image" size={19} color={colors.accent} />
              <Text style={styles.actionText} color="accent">
                {upload.isPending ? "Uploading…" : media.length ? "Add another slide" : "Add photos"}
              </Text>
            </Pressable>
            <Text variant="caption" color="muted">{content.length}/{CONTENT_LIMIT}</Text>
          </View>

          <Pressable accessibilityRole="button" accessibilityState={{ expanded: topicsOpen }} onPress={() => setTopicsOpen((open) => !open)} style={styles.topicsHeader}>
            <Text style={styles.topicsTitle} color="muted">
              Topics <Text style={styles.optional} color="muted">(optional)</Text>
              {!!topics.size && <Text style={styles.optional} color="muted"> ({topics.size})</Text>}
            </Text>
            <Icon name={topicsOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
          </Pressable>
          {topicsOpen && (
            <View style={styles.topicPanel}>
              <Text variant="caption" color="muted" style={styles.selectedCount}>
                {topics.size}/{MAX_TOPICS} selected{topics.size >= MAX_TOPICS ? " — remove one to pick another" : ""}
              </Text>
              {categories.isLoading && <Text color="muted">Loading topics…</Text>}
              {categories.data?.map((category) => {
                const categoryOpen = openCategoryId === category.id;
                const selectedInCategory = category.interests.filter((interest) => topics.has(interest.id)).length;
                return (
                  <View key={category.id} style={[styles.category, { borderBottomColor: colors.border }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: categoryOpen }}
                      onPress={() => setOpenCategoryId((current) => current === category.id ? null : category.id)}
                      style={styles.categoryHeader}
                    >
                      <Text style={styles.categoryTitle}>
                        {category.name}{selectedInCategory ? <Text color="muted"> ({selectedInCategory})</Text> : null}
                      </Text>
                      <Icon name={categoryOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
                    </Pressable>
                    {categoryOpen && (
                      <View style={styles.topicList}>
                        {category.interests.map((interest) => {
                          const selected = topics.has(interest.id);
                          const disabled = !selected && topics.size >= MAX_TOPICS;
                          return (
                            <Pressable
                              key={interest.id}
                              accessibilityRole="button"
                              accessibilityState={{ selected, disabled }}
                              disabled={disabled}
                              onPress={() => toggleTopic(interest.id)}
                              style={[
                                styles.topicPill,
                                { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.surface },
                                disabled && styles.disabled,
                              ]}
                            >
                              <Text style={[styles.topicPillText, { color: selected ? colors.onAccent : colors.text }]}>{interest.name}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
              <Text variant="caption" color="muted" style={styles.topicHelp}>
                Helps people browsing find this, and powers recommendations for it.
              </Text>
            </View>
          )}

          {!!error && <Text color="danger" accessibilityRole="alert" style={[styles.error, { backgroundColor: colors.surface }]}>{error}</Text>}
        </ScrollView>

        <View style={[styles.actionBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <Pressable accessibilityLabel="Close" onPress={close} hitSlop={10} style={styles.bottomIcon}>
            <Icon name="x" size={24} color={colors.textMuted} />
          </Pressable>
          <View style={styles.actionBarRight}>
            <Pressable accessibilityLabel="More posting options" disabled={!canSubmit || create.isPending} onPress={showMore} style={[styles.bottomIcon, (!canSubmit || create.isPending) && styles.disabled]}>
              <Icon name="more-horizontal" size={22} color={colors.textMuted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Post"
              disabled={!canSubmit || create.isPending || upload.isPending}
              onPress={() => void submit()}
              style={[styles.postButton, { backgroundColor: colors.accent }, (!canSubmit || create.isPending || upload.isPending) && styles.disabled]}
            >
              <Text style={[styles.postButtonText, { color: colors.onAccent }]}>{create.isPending ? "Posting…" : "Post"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36 },
  identity: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  identityText: { flex: 1, fontSize: 14, lineHeight: 20 },
  identityName: { fontWeight: "600" },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headingInput: { fontFamily: Platform.select({ ios: "Georgia", android: "serif" }), fontSize: 24, lineHeight: 31, paddingHorizontal: 0, paddingVertical: 0 },
  headingCount: { marginTop: 3, marginBottom: 10 },
  formatBar: { height: 32, flexDirection: "row", alignItems: "center", gap: 8 },
  formatButton: { width: 24, height: 28, alignItems: "center", justifyContent: "center" },
  bodyInput: { minHeight: 190, fontSize: 16, lineHeight: 23, paddingHorizontal: 0, paddingTop: 2, paddingBottom: 12 },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  mediaItem: { width: "48%", aspectRatio: 1, borderRadius: 12, overflow: "hidden" },
  mediaImage: { width: "100%", height: "100%" },
  removeMedia: { position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  inlineAction: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  actionText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  attachmentRow: { marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topicsHeader: { marginTop: 24, minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topicsTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  optional: { fontWeight: "400" },
  topicPanel: { paddingTop: 8 },
  selectedCount: { marginBottom: 10 },
  category: { borderBottomWidth: StyleSheet.hairlineWidth },
  categoryHeader: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  categoryTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  topicList: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 12 },
  topicPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  topicPillText: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  topicHelp: { marginTop: 8 },
  error: { marginTop: 16, padding: 12, borderRadius: 12 },
  actionBar: { minHeight: 64, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionBarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  bottomIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  postButton: { minWidth: 68, height: 40, paddingHorizontal: 20, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  postButtonText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  disabled: { opacity: 0.45 },
});

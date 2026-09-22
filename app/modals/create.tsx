import { Icon } from "@/components/core/Icon";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { SlideInDown, useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/core";
import { useTheme } from "@/providers/ThemeProvider";
import { useProbationalLock } from "@/features/account/probational";

const CHOICES = [
  { key: "post", icon: "pen-square", label: "Post", description: "Share a thought with your followers" },
  { key: "project", icon: "folder-plus", label: "Project", description: "List a file, event, course, or paid link" },
] as const;

export default function CreateModal() {
  const router = useRouter();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  // Probational users don't get the social layer, and Project
  // creation is one of their four locked pages — see
  // features/account/probational.ts. Both entries can disappear at
  // once; see the empty-state fallback below.
  const postLocked = useProbationalLock("probational_post_enabled");
  const createProjectLocked = useProbationalLock("probational_create_project_enabled");
  const choices = CHOICES.filter((c) => (c.key === "project" ? !createProjectLocked : !postLocked));

  const openPostComposer = () => {
    router.replace("/compose");
  };

  const selectChoice = (key: (typeof CHOICES)[number]["key"]) => {
    if (key === "post") {
      openPostComposer();
      return;
    }
    router.replace("/projects/new");
  };

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityLabel="Close create menu"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        onPress={() => router.back()}
      />
      <Animated.View entering={reduced ? undefined : SlideInDown.duration(240)} style={[styles.sheet, { backgroundColor: colors.background }]}>
        <SafeAreaView edges={["bottom"]}>
          <View style={styles.handleWrap}><View style={[styles.handle, { backgroundColor: colors.border }]} /></View>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">Create</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={() => router.back()} style={styles.close}>
              <Icon name="x" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.choices}>
            {choices.length === 0 && (
              <Text color="muted" align="center" style={styles.empty}>
                Nothing to create just yet — this unlocks once your account is approved.
              </Text>
            )}
            {choices.map((choice) => (
              <Pressable
                key={choice.key}
                accessibilityRole="button"
                accessibilityLabel={`Create ${choice.label}`}
                onPress={() => selectChoice(choice.key)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
              >
                <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
                  <Icon name={choice.icon} size={20} color={colors.accent} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.label}>{choice.label}</Text>
                  <Text style={styles.description} color="muted" numberOfLines={1}>{choice.description}</Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  handleWrap: { height: 18, alignItems: "center", justifyContent: "flex-end" },
  handle: { width: 40, height: 6, borderRadius: 999 },
  header: { minHeight: 52, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.25 },
  close: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  choices: { paddingHorizontal: 12, paddingBottom: 8 },
  row: { minHeight: 72, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: "500" },
  description: { fontSize: 12, lineHeight: 16 },
  empty: { paddingVertical: 24, paddingHorizontal: 8 },
});

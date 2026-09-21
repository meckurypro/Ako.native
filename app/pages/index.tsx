import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Text } from "@/components/core";
import { useActiveIdentity } from "@/features/compose/api";
import { useMyPages, useSwitchMode } from "@/features/pages/api";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

const TYPE_LABEL = { organization: "Organisation", brand: "Brand", product: "Product" } as const;

export default function AccountMode() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const identity = useActiveIdentity();
  const pages = useMyPages();
  const switching = useSwitchMode();
  const activePage = identity.data?.mode === "page" ? identity.data.page.id : null;

  const switchTo = async (id: string | null) => {
    if (activePage === id) return;
    try {
      await switching.mutateAsync(id);
      router.replace("/(tabs)/profile");
    } catch (err) {
      Alert.alert("Couldn't switch", err instanceof Error ? err.message : "Try again.");
    }
  };

  return <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}><ScrollView contentContainerStyle={s.content}><View style={s.header}><Pressable onPress={() => router.back()} style={s.back}><MaterialCommunityIcons name="arrow-left" size={23} color={colors.textMuted} /></Pressable><Text style={s.title}>Account mode</Text></View><Text style={s.section} color="muted">SWITCH ACCOUNT MODE</Text><View style={[s.card, { backgroundColor: colors.surface }]}><ModeRow name={profile?.display_name ?? "You"} subtitle="Personal account" avatar={profile?.avatar_url} active={!activePage} colors={colors} onPress={() => void switchTo(null)} />{pages.data?.map((page) => <ModeRow key={page.id} name={page.name} subtitle={`${page.my_role_label} · ${TYPE_LABEL[page.page_type]}`} avatar={page.avatar_url} active={activePage === page.id} colors={colors} onPress={() => void switchTo(page.id)} />)}<Pressable onPress={() => router.push("/pages/new")} style={[s.row, { borderTopColor: colors.border }]}><View style={[s.plus, { backgroundColor: colors.accentSoft }]}><MaterialCommunityIcons name="plus" size={21} color={colors.accent} /></View><Text color="accent" style={s.rowName}>Create a page</Text></Pressable></View><Text variant="caption" color="muted" style={s.help}>{"While you're acting as a page, your posts, name, and photo show its instead of yours — everyone managing it shares the same page. "}<Text color="accent" onPress={() => router.push("/pages/new")}>Set one up.</Text></Text></ScrollView></SafeAreaView>;
}

function ModeRow({ name, subtitle, avatar, active, colors, onPress }: { name: string; subtitle: string; avatar: string | null | undefined; active: boolean; colors: any; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[s.row, { borderBottomColor: colors.border }]}><Avatar uri={avatar} name={name} size={40} /><View style={s.rowCopy}><Text style={s.rowName}>{name}</Text><Text variant="caption" color="muted">{subtitle}</Text></View>{active ? <MaterialCommunityIcons name="check" size={20} color={colors.accent} /> : null}</Pressable>;
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  back: { width: 24, height: 32, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "serif", fontSize: 21, fontWeight: "700" },
  section: { fontSize: 12, fontWeight: "600", letterSpacing: .6, marginLeft: 4, marginBottom: 8 },
  card: { borderRadius: 16, overflow: "hidden" },
  row: { minHeight: 68, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowCopy: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: "600" },
  plus: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  help: { marginTop: 16, paddingHorizontal: 4, lineHeight: 18 },
});

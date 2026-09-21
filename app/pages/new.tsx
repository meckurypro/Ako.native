// @ts-nocheck -- Expo Router's generated route union updates after the next dev-server restart.
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Icon } from "@/components/core/Icon";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/core";
import { useCategories } from "@/features/onboarding/api";
import { type PageType, pageUsernameAvailable, useCreatePage, usePageEligibility } from "@/features/pages/api";
import { useTheme } from "@/providers/ThemeProvider";

const TYPES: [PageType, string][] = [["organization", "Organisation"], ["brand", "Brand"], ["product", "Product"]];
const NAME = { organization: "Organisation name", brand: "Brand name", product: "Product name" };
const PLACEHOLDER = { organization: "Acme Inc", brand: "Acme", product: "Acme Widget" };
const TAGLINE = { organization: "What this organisation does", brand: "What this brand does", product: "What this product does" };

type Status = "idle" | "checking" | "available" | "taken" | "error";

export default function NewPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const eligibility = usePageEligibility();
  const categories = useCategories();
  const create = useCreatePage();
  const [type, setType] = useState<PageType>("organization");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const candidate = username.trim();
    if (candidate.length < 3) return;
    let current = true;
    const timer = setTimeout(() => {
      void pageUsernameAvailable(candidate)
        .then(ok => { if (current) setStatus(ok ? "available" : "taken"); })
        .catch(() => { if (current) setStatus("error"); });
    }, 400);
    return () => { current = false; clearTimeout(timer); };
  }, [username]);

  const handleUsername = (value: string) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
    setUsername(normalized);
    setStatus(normalized.length < 3 ? "idle" : "checking");
  };

  const e = eligibility.data;
  const reasons = !e || e.allowed ? [] : [
    !e.posts_met ? `You need at least ${e.posts_required} posts in the last 30 days (you have ${e.posts_30d}).` : null,
    !e.distinct_engaged_met ? `You need at least ${e.distinct_engaged_required} distinct engaged posts in the last 30 days (you have ${e.distinct_engaged_30d}).` : null,
    !e.account_age_met ? `Your account needs to be at least ${e.account_age_required} days old (yours is ${e.account_age_days}).` : null,
  ].filter(Boolean) as string[];

  const toggle = (id: string) => setTopics(old => {
    const next = new Set(old);
    if (next.has(id)) next.delete(id);
    else if (next.size < 5) next.add(id);
    return next;
  });

  const submit = async () => {
    setError(null);
    if (!name.trim() || !username.trim() || !role.trim()) return setError("Name, username, and your role are required.");
    if (status === "taken") return setError("That username is already taken.");
    if (reasons.length) return setError(reasons[0]);
    try {
      if (!await pageUsernameAvailable(username)) return setError("That username is already taken.");
      await create.mutateAsync({ page_type: type, name: name.trim(), username, role_label: role.trim(), tagline: tagline.trim() || undefined, bio: bio.trim() || undefined, topic_ids: [...topics] });
      Alert.alert("Page created", `${name.trim()} created successfully.`, [{ text: "OK", onPress: () => router.replace("/pages") }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that page.");
    }
  };

  const input = [s.input, { backgroundColor: colors.surface, color: colors.text }];

  return <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <Pressable onPress={() => router.back()}><Icon name="arrow-left" size={23} color={colors.textMuted} /></Pressable>
        <Text style={s.title}>Create a page</Text>
      </View>
      <View style={s.types}>{TYPES.map(([value, label]) => <Pressable key={value} onPress={() => setType(value)} style={[s.type, { borderColor: type === value ? colors.accent : colors.border, backgroundColor: type === value ? colors.accentSoft : colors.surface }]}><Text style={s.typeText}>{label}</Text></Pressable>)}</View>
      {reasons.length > 0 && <View style={[s.warning, { borderColor: colors.danger }]}>
        <Text color="danger" style={s.warningTitle}>Page creation is not unlocked yet:</Text>
        {reasons.map(reason => <Text key={reason} variant="caption" color="danger">• {reason}</Text>)}
        {e && <View style={s.progressList}><Progress label="Posts (last 30 days)" current={e.posts_30d} required={e.posts_required} colors={colors} /><Progress label="Distinct posts engaged with (last 30 days)" current={e.distinct_engaged_30d} required={e.distinct_engaged_required} colors={colors} />{e.account_age_required > 0 && <Progress label="Account age (days)" current={e.account_age_days} required={e.account_age_required} colors={colors} />}</View>}
        <Text variant="caption" color="danger">Keep posting and engaging with other people&apos;s posts to unlock this.</Text>
      </View>}
      <Label text={NAME[type]} />
      <TextInput value={name} onChangeText={value => setName(value.slice(0, 80))} placeholder={PLACEHOLDER[type]} placeholderTextColor={colors.textMuted} style={input} />
      <Label text="Username" />
      <TextInput value={username} onChangeText={handleUsername} placeholder="meckuryai" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={input} />
      <Text variant="caption" color="muted" style={s.hint}>ako.app/page/{username || "..."}</Text>
      {status !== "idle" && <Text variant="caption" color={status === "available" ? "accent" : status === "taken" ? "danger" : "muted"} style={s.hint}>{status === "checking" ? "Checking availability…" : status === "available" ? "Username is available." : status === "taken" ? "That username is already taken." : "Couldn't check username."}</Text>}
      <Label text="Your role at it" />
      <TextInput value={role} onChangeText={value => setRole(value.slice(0, 60))} placeholder="CEO, Founder, Community Lead…" placeholderTextColor={colors.textMuted} style={input} />
      <Text variant="caption" color="muted" style={s.hint}>Shown as &quot;{role || "Your role"} at {name || "this page"}&quot; on your profile.</Text>
      <Label text="Tagline" />
      <TextInput value={tagline} onChangeText={value => setTagline(value.slice(0, 100))} placeholder={TAGLINE[type]} placeholderTextColor={colors.textMuted} style={input} />
      <Label text="Bio" />
      <TextInput value={bio} onChangeText={value => setBio(value.slice(0, 280))} multiline textAlignVertical="top" style={[...input, s.bio]} />
      <Pressable onPress={() => setTopicsOpen(value => !value)} style={s.topicHeader}><Text color="muted">Topics (optional){topics.size ? ` (${topics.size})` : ""}</Text><Icon name={topicsOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} /></Pressable>
      {topicsOpen && <View><Text variant="caption" color="muted">{topics.size}/5 selected</Text>{categories.data?.map(cat => <View key={cat.id} style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}><Pressable onPress={() => setOpenCategory(value => value === cat.id ? null : cat.id)} style={s.topicHeader}><Text>{cat.name}</Text><Icon name={openCategory === cat.id ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} /></Pressable>{openCategory === cat.id && <View style={s.pills}>{cat.interests.map(i => { const selected = topics.has(i.id); return <Pressable key={i.id} disabled={!selected && topics.size >= 5} onPress={() => toggle(i.id)} style={[s.pill, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.surface }]}><Text style={{ fontSize: 12, color: selected ? colors.onAccent : colors.text }}>{i.name}</Text></Pressable>; })}</View>}</View>)}</View>}
      {error && <Text color="danger" style={s.error}>{error}</Text>}
      <Pressable disabled={create.isPending} onPress={() => void submit()} style={[s.submit, { backgroundColor: colors.accent }, create.isPending && { opacity: .5 }]}><Text style={{ color: colors.onAccent, fontWeight: "600" }}>{create.isPending ? "Creating…" : `Create ${type}`}</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

function Label({ text }: { text: string }) {
  return <Text variant="caption" color="muted" style={s.label}>{text}</Text>;
}

function Progress({ label, current, required, colors }: { label: string; current: number; required: number; colors: any }) {
  const pct = required ? Math.min(1, current / required) : 1;
  return <View><View style={s.progressLabel}><Text variant="caption" color="muted">{label}</Text><Text variant="caption" color="muted">{current} / {required}</Text></View><View style={[s.track, { backgroundColor: colors.border }]}><View style={[s.fill, { backgroundColor: colors.accent, width: `${pct * 100}%` }]} /></View></View>;
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  title: { fontFamily: "serif", fontSize: 21, fontWeight: "700" },
  types: { flexDirection: "row", gap: 8 },
  type: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  typeText: { fontSize: 14, fontWeight: "600" },
  warning: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 18, gap: 4 },
  warningTitle: { fontWeight: "600", marginBottom: 2 },
  progressList: { gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(200,90,70,.25)", paddingTop: 10, marginVertical: 6 },
  progressLabel: { flexDirection: "row", justifyContent: "space-between" },
  track: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 4 },
  fill: { height: 6, borderRadius: 3 },
  label: { marginTop: 18, marginBottom: 6 },
  input: { minHeight: 48, borderRadius: 12, paddingHorizontal: 16, fontSize: 14 },
  bio: { minHeight: 84, paddingTop: 12 },
  hint: { marginTop: 5 },
  topicHeader: { minHeight: 44, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 12 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  error: { marginTop: 14 },
  submit: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 20 },
});

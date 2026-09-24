import { useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Icon, type IconName } from "@/components/core/Icon";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Button, Input, Text } from "@/components/core";
import { useAvatarUpload } from "@/features/profile/useAvatarUpload";
import { friendlyAuthError, normalizeUsername } from "@/features/auth/validation";
import { useBiometricCapability, useBiometricLockSetting } from "@/features/security/biometric";
import { useNotificationSettings } from "@/features/notifications/settings";
import { ensurePermission } from "@/lib/permissions";
import {
  useBlockedList,
  useChangePassword,
  useDeactivateAccount,
  useMutedList,
  useOwnSettingsProfile,
  useProfileVisitCount,
  useRoles,
  useSoundSettings,
  useToggleHideFollowersList,
  useToggleHideFollowingList,
  useTogglePrivateAccount,
  useUnblockAccount,
  useUnmuteAccount,
  useUpdateProfileRoles,
  useUpdateSettingsProfile,
  useUsernameAvailability,
  type AccountRow,
  type SoundMode,
} from "@/features/settings/api";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme, type ThemePreference } from "@/providers/ThemeProvider";

type SectionId = "profile" | "security" | "privacy" | "appearance" | "notifications" | "sound" | "advanced";

const THEME_OPTIONS: { value: ThemePreference; label: string; description: string; icon: IconName }[] = [
  { value: "light", label: "Light", description: "Always use the light theme", icon: "sun" },
  { value: "dark", label: "Dark", description: "Always use the dark theme", icon: "moon" },
  { value: "system", label: "System", description: "Match your device's setting", icon: "monitor-smartphone" },
];

const SOUND_OPTIONS: { value: SoundMode; label: string; description: string; icon: IconName }[] = [
  { value: "normal", label: "Normal", description: "Sounds for messages, likes, gifts, purchases, and live rooms", icon: "volume-2" },
  { value: "minimalist", label: "Minimalist", description: "Only new messages, gifts, purchases, and errors", icon: "volume-1" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, preference } = useTheme();
  const profile = useOwnSettingsProfile();
  const [open, setOpen] = useState<SectionId | null>("profile");

  return <SafeAreaView edges={["top", "left", "right"]} style={[s.safe, { backgroundColor: colors.background }]}>
    <View style={[s.header, { borderBottomColor: colors.border }]}>
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")} style={s.back}>
        <Icon name="arrow-left" size={22} color={colors.textSecondary} />
      </Pressable>
      <Text style={s.title}>Settings</Text>
    </View>
    {profile.isLoading ? <View style={s.loading}><ActivityIndicator color={colors.accent} /><Text color="muted">Loading…</Text></View> : profile.isError || !profile.data ? <View style={s.loading}><Text color="danger">Could not load settings.</Text><Button label="Try again" variant="secondary" onPress={() => void profile.refetch()} /></View> : <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <SettingsSection id="profile" icon="user-circle-2" title="Profile" summary={profile.data.display_name} open={open} setOpen={setOpen}><ProfileForm key={profile.data.id} profile={profile.data} /></SettingsSection>
      <SettingsSection id="security" icon="key-round" title="Account & security" open={open} setOpen={setOpen}><SecurityForm /></SettingsSection>
      <SettingsSection id="privacy" icon="shield" title="Privacy" summary={profile.data.is_private ? "Private" : "Public"} open={open} setOpen={setOpen}><PrivacySettings profile={profile.data} /></SettingsSection>
      <SettingsSection id="appearance" icon="palette" title="Appearance" summary={THEME_OPTIONS.find(option => option.value === preference)?.label ?? "System"} open={open} setOpen={setOpen}><AppearanceSettings /></SettingsSection>
      <SettingsSection id="notifications" icon="bell" title="Notifications" open={open} setOpen={setOpen}><NotificationSettings /></SettingsSection>
      <SettingsSection id="sound" icon="volume-2" title="Sound" open={open} setOpen={setOpen}><SoundSettings /></SettingsSection>
      <SettingsSection id="advanced" icon="sliders-horizontal" title="Advanced" danger open={open} setOpen={setOpen}><AdvancedSettings /></SettingsSection>
      <LogoutButton />
    </ScrollView>}
  </SafeAreaView>;
}

function SettingsSection({ id, icon, title, summary, danger, open, setOpen, children }: { id: SectionId; icon: IconName; title: string; summary?: string; danger?: boolean; open: SectionId | null; setOpen: (id: SectionId | null) => void; children: ReactNode }) {
  const { colors } = useTheme();
  const expanded = open === id;
  return <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Pressable onPress={() => setOpen(expanded ? null : id)} style={s.sectionHeader}>
      <View style={[s.sectionIcon, { backgroundColor: danger ? "rgba(208,88,74,.14)" : colors.accentSoft }]}><Icon name={icon} size={18} color={danger ? colors.danger : colors.accent} /></View>
      <View style={s.sectionCopy}><Text style={[s.sectionTitle, danger && { color: colors.danger }]}>{title}</Text>{summary ? <Text color="muted" numberOfLines={1} style={s.summary}>{summary}</Text> : null}</View>
      <Icon name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
    </Pressable>
    {expanded ? <View style={[s.sectionBody, { borderTopColor: colors.border }]}>{children}</View> : null}
  </View>;
}

function ProfileForm({ profile }: { profile: any }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const update = useUpdateSettingsProfile();
  const updateRoles = useUpdateProfileRoles();
  const upload = useAvatarUpload();
  const roles = useRoles();
  const visits = useProfileVisitCount(profile.id);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url ?? "");
  const [roleIds, setRoleIds] = useState<string[]>(() => [...(profile.profile_roles ?? [])].sort((a: any, b: any) => a.position - b.position).map((row: any) => Array.isArray(row.role) ? row.role[0]?.id : row.role?.id).filter(Boolean));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availability = useUsernameAvailability(username, profile.username, user?.id);

  const choosePhoto = async (source: "camera" | "library") => {
    const granted = await ensurePermission(source === "camera" ? "camera" : "mediaLibrary");
    if (!granted) return;
    const result = source === "camera" ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: .9 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: .9 });
    if (result.canceled) return;
    try { await upload.mutateAsync(result.assets[0]); await queryClient.invalidateQueries({ queryKey: ["own-profile"] }); }
    catch (err) { Alert.alert("Couldn't update photo", friendlyAuthError(err, "Choose another image or try again.")); }
  };

  const toggleRole = (id: string) => setRoleIds(previous => previous.includes(id) ? previous.filter(roleId => roleId !== id) : previous.length >= 3 ? previous : [...previous, id]);

  const save = async () => {
    setError(null); setSaved(false);
    const normalized = normalizeUsername(username.trim());
    const usernameChanged = normalized !== profile.username;
    if (!displayName.trim()) return setError("Display name is required.");
    if (usernameChanged) {
      if (normalized.length < 3) return setError("Username must be at least 3 characters.");
      if (availability.data === false) return setError("That username is already taken.");
      if (availability.isFetching || availability.isError) return setError("Still checking that username. Try again in a moment.");
    }
    try {
      await Promise.all([update.mutateAsync({ display_name: displayName.trim(), bio: bio.trim() || null, website_url: websiteUrl.trim() || null, ...(usernameChanged ? { username: normalized } : {}) }), updateRoles.mutateAsync(roleIds)]);
      setSaved(true);
    } catch (err) { setError(friendlyAuthError(err, "Couldn't save changes.")); }
  };

  const usernameHint = availability.isFetching ? "Checking availability…" : availability.data ? "Username is available." : availability.data === false ? "That username is already taken." : "Lowercase letters, numbers, and underscores only.";
  const usernameError = availability.data === false ? "That username is already taken." : null;

  return <View style={s.form}>
    <View style={s.avatarBlock}><Pressable accessibilityRole="button" accessibilityLabel="Change photo" disabled={upload.isPending} onPress={() => void choosePhoto("library")}><Avatar uri={profile.avatar_url} name={displayName || username || "AKọ"} size={92} /><View pointerEvents="none" style={[s.cameraBadge, { backgroundColor: colors.accent }]}><Icon name="camera" size={14} color={colors.background} /></View></Pressable><View style={s.photoActions}><Button label="Change photo" variant="secondary" loading={upload.isPending} onPress={() => void choosePhoto("library")} /><Button label="Camera" variant="ghost" disabled={upload.isPending} onPress={() => void choosePhoto("camera")} /></View><View style={s.visitRow}><Icon name="eye" size={15} color={colors.textMuted} /><Text color="muted" style={s.visitText}><Text style={{ color: colors.text, fontWeight: "700" }}>{visits.data ?? 0}</Text> visits in the last 30 days</Text></View></View>
    <Input label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={80} />
    <Input label="Username" value={username} onChangeText={value => setUsername(normalizeUsername(value))} autoCapitalize="none" error={usernameError} hint={usernameHint} />
    <Input label="Email" value={user?.email ?? ""} editable={false} hint="This can't be changed here." />
    <Input label="Bio" value={bio} onChangeText={value => setBio(value.slice(0, 280))} multiline style={s.bioInput} hint={`${bio.length}/280`} />
    <Input label="Website" value={websiteUrl} onChangeText={setWebsiteUrl} keyboardType="url" autoCapitalize="none" placeholder="https://" />
    {roles.data?.length ? <View style={s.roles}><Text variant="label" color="secondary">Job or hobby <Text color="muted">({roleIds.length}/3)</Text></Text><View style={s.roleWrap}>{roles.data.map(role => { const selected = roleIds.includes(role.id); const disabled = !selected && roleIds.length >= 3; return <Pressable key={role.id} disabled={disabled} onPress={() => toggleRole(role.id)} style={[s.rolePill, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.surfaceElevated, opacity: disabled ? .45 : 1 }]}><Text style={{ color: selected ? colors.onAccent : colors.text, fontSize: 12, fontWeight: "600" }}>{role.label}</Text></Pressable>; })}</View></View> : null}
    {error ? <Text color="danger" variant="caption">{error}</Text> : null}{saved ? <Text color="accent" variant="caption">Profile updated.</Text> : null}
    <Button label="Save changes" loading={update.isPending || updateRoles.isPending} onPress={() => void save()} />
  </View>;
}

function SecurityForm() {
  const change = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const submit = async () => { setSuccess(false); change.reset(); if (newPassword.length < 8) return; try { await change.mutateAsync({ currentPassword, newPassword }); setCurrentPassword(""); setNewPassword(""); setSuccess(true); } catch {} };
  return <View style={s.form}><Input label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoComplete="current-password" /><Input label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" hint="At least 8 characters." />{change.isError ? <Text color="danger" variant="caption">{change.error instanceof Error ? change.error.message : "Couldn't change your password."}</Text> : null}{success ? <Text color="accent" variant="caption">Password updated.</Text> : null}<Button label="Update password" loading={change.isPending} onPress={() => void submit()} /><BiometricLockSettings /></View>;
}

function BiometricLockSettings() {
  const capability = useBiometricCapability();
  const setting = useBiometricLockSetting();
  if (capability.loading || setting.loading) return null;
  if (!capability.supported) return null; // no point offering the toggle on hardware that can't do it
  return <ToggleRow icon="scan-face" title={`Require ${capability.label}`} description={capability.enrolled ? `Lock Akọ behind ${capability.label} whenever you return to the app.` : `Set up ${capability.label} in your device settings first.`} checked={setting.enabled} pending={false} onToggle={() => void setting.setEnabled(!setting.enabled)} error={setting.enabled && !capability.enrolled ? `${capability.label} isn't set up on this device yet — this will stay off until it is.` : null} />;
}

function PrivacySettings({ profile }: { profile: any }) {
  const togglePrivate = useTogglePrivateAccount(); const toggleFollowers = useToggleHideFollowersList(); const toggleFollowing = useToggleHideFollowingList();
  return <View><ToggleRow icon="lock" title="Private account" description="Only followers can see your posts" checked={!!profile.is_private} pending={togglePrivate.isPending} onToggle={() => togglePrivate.mutate(!profile.is_private)} error={togglePrivate.isError ? "Couldn't update this setting. Try again." : null} /><ToggleRow icon="users" title="Hide followers list" description="Others won't be able to see who follows you" checked={!!profile.hide_followers_list} pending={toggleFollowers.isPending} onToggle={() => toggleFollowers.mutate(!profile.hide_followers_list)} error={toggleFollowers.isError ? "Couldn't update this setting. Try again." : null} /><ToggleRow icon="user-circle-2" title="Hide following list" description="Others won't be able to see who you follow" checked={!!profile.hide_following_list} pending={toggleFollowing.isPending} onToggle={() => toggleFollowing.mutate(!profile.hide_following_list)} error={toggleFollowing.isError ? "Couldn't update this setting. Try again." : null} /><AccountList title="Blocked accounts" icon="user-x" kind="blocked" /><AccountList title="Muted accounts" icon="volume-x" kind="muted" /></View>;
}

function AccountList({ title, icon, kind }: { title: string; icon: IconName; kind: "blocked" | "muted" }) {
  const { colors } = useTheme(); const blocked = useBlockedList(); const muted = useMutedList(); const unblock = useUnblockAccount(); const unmute = useUnmuteAccount();
  const data = kind === "blocked" ? blocked.data : muted.data; const loading = kind === "blocked" ? blocked.isLoading : muted.isLoading;
  return <View style={s.accountList}><View style={s.listTitle}><Icon name={icon} size={15} color={colors.textMuted} /><Text color="muted" style={s.listTitleText}>{title}</Text></View>{loading ? <ActivityIndicator color={colors.accent} /> : !data?.length ? <Text color="muted" style={s.emptyList}>No {kind} accounts.</Text> : data.map(account => <AccountRowView key={account.id} account={account} label={kind === "blocked" ? "Unblock" : "Unmute"} onPress={() => kind === "blocked" ? unblock.mutate(account.id) : unmute.mutate(account.id)} />)}</View>;
}

function AccountRowView({ account, label, onPress }: { account: AccountRow; label: string; onPress: () => void }) { const { colors } = useTheme(); return <View style={[s.accountRow, { backgroundColor: colors.surfaceElevated }]}><View style={s.accountIdentity}><Avatar uri={account.avatar_url} name={account.display_name} size={34} /><View><Text style={s.accountName}>{account.display_name}</Text><Text color="muted" style={s.accountUsername}>@{account.username}</Text></View></View><Pressable onPress={onPress}><Text color="accent" style={s.rowAction}>{label}</Text></Pressable></View>; }

function AppearanceSettings() { const { colors, preference, setPreference } = useTheme(); return <View style={[s.optionGroup, { borderColor: colors.border }]}>{THEME_OPTIONS.map((option, index) => <OptionRow key={option.value} first={index === 0} icon={option.icon} label={option.label} description={option.description} selected={preference === option.value} onPress={() => void setPreference(option.value)} />)}</View>; }

function NotificationSettings() {
  const { user } = useAuth();
  const notifications = useNotificationSettings(user?.id);
  return <View><ToggleRow icon={notifications.enabled ? "bell" : "bell-off"} title="Push notifications" description="Get notified about new messages, gifts, and activity on your posts" checked={notifications.enabled} pending={notifications.loading} onToggle={() => void notifications.setEnabled(!notifications.enabled)} /></View>;
}

function SoundSettings() { const sound = useSoundSettings(); const { colors } = useTheme(); const label = sound.enabled ? (SOUND_OPTIONS.find(option => option.value === sound.mode)?.label ?? "Normal") : "Off"; return <View><ToggleRow icon={sound.enabled ? "volume-2" : "volume-x"} title="Sounds" description="Play sounds for messages, likes, gifts, and more" checked={sound.enabled} pending={false} onToggle={() => void sound.setEnabled(!sound.enabled)} />{sound.enabled ? <View style={[s.optionGroup, { borderColor: colors.border }]}>{SOUND_OPTIONS.map((option, index) => <OptionRow key={option.value} first={index === 0} icon={option.icon} label={option.label} description={option.description} selected={sound.mode === option.value} onPress={() => void sound.setMode(option.value)} />)}</View> : null}<Text color="muted" variant="caption" style={s.soundSummary}>Current sound mode: {label}</Text></View>; }

function AdvancedSettings() {
  const { signOut, user } = useAuth(); const router = useRouter(); const deactivate = useDeactivateAccount();
  const confirm = () => Alert.alert("Deactivate account?", "This signs you out everywhere and hides your profile and posts. Your wallet and transaction history are kept for financial record-keeping. This can't be undone from the app.", [{ text: "Cancel", style: "cancel" }, { text: "Confirm deactivation", style: "destructive", onPress: () => void run() }]);
  const run = async () => { try { await deactivate.mutateAsync(); await signOut(); router.replace("/(auth)"); } catch (err) { Alert.alert("Couldn't deactivate account", friendlyAuthError(err, "Please try again.")); } };
  return <View style={s.form}><Text color="secondary">Advanced account controls are kept here so they are not mixed with routine settings.</Text><Button label={deactivate.isPending ? "Deactivating…" : "Deactivate account"} variant="danger" loading={deactivate.isPending} onPress={confirm} />{user?.email ? <Text color="muted" variant="caption">Signed in as {user.email}</Text> : null}</View>;
}

function LogoutButton() { const { signOut } = useAuth(); const router = useRouter(); const [loading, setLoading] = useState(false); const logout = async () => { setLoading(true); try { await signOut(); router.replace("/(auth)"); } catch (err) { Alert.alert("Couldn't sign out", friendlyAuthError(err, "Check your connection and try again.")); setLoading(false); } }; return <Pressable disabled={loading} onPress={() => void logout()} style={s.logout}><Icon name="log-out" size={17} color="#85817C" /><Text color="muted" style={s.logoutText}>{loading ? "Logging out…" : "Log out"}</Text></Pressable>; }

function ToggleRow({ icon, title, description, checked, pending, onToggle, error }: { icon: IconName; title: string; description: string; checked: boolean; pending: boolean; onToggle: () => void; error?: string | null }) {
  const { colors } = useTheme();
  return <View style={[s.toggleRow, { backgroundColor: colors.surfaceElevated }]}><View style={s.toggleMain}><Icon name={icon} size={18} color={colors.textMuted} /><View style={s.toggleCopy}><Text style={s.toggleTitle}>{title}</Text><Text color="muted" style={s.toggleDescription}>{description}</Text></View><Switch value={checked} disabled={pending} onValueChange={onToggle} trackColor={{ false: colors.border, true: colors.accent }} thumbColor={colors.background} /></View>{error ? <Text color="danger" variant="caption" style={s.toggleError}>{error}</Text> : null}</View>;
}

function OptionRow({ first, icon, label, description, selected, onPress }: { first: boolean; icon: IconName; label: string; description: string; selected: boolean; onPress: () => void }) { const { colors } = useTheme(); return <Pressable onPress={onPress} style={[s.optionRow, !first && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}><Icon name={icon} size={18} color={colors.textMuted} /><View style={s.optionCopy}><Text style={s.optionLabel}>{label}</Text><Text color="muted" style={s.optionDescription}>{description}</Text></View>{selected ? <Icon name="check" size={18} color={colors.accent} /> : null}</Pressable>; }

const s = StyleSheet.create({ safe: { flex: 1 }, header: { height: 62, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: StyleSheet.hairlineWidth }, back: { width: 28, height: 36, alignItems: "center", justifyContent: "center" }, title: { fontFamily: "serif", fontSize: 25, lineHeight: 31 }, loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 30 }, content: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 42, gap: 12 }, section: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, overflow: "hidden" }, sectionHeader: { minHeight: 64, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 }, sectionIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }, sectionCopy: { flex: 1, minWidth: 0 }, sectionTitle: { fontSize: 15, fontWeight: "700" }, summary: { fontSize: 12, lineHeight: 16, marginTop: 2 }, sectionBody: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14 }, form: { gap: 14 }, avatarBlock: { alignItems: "center", gap: 10, marginBottom: 4 }, cameraBadge: { position: "absolute", right: 0, bottom: 0, borderRadius: 99, padding: 6 }, photoActions: { flexDirection: "row", gap: 8 }, visitRow: { flexDirection: "row", alignItems: "center", gap: 6 }, visitText: { fontSize: 12, lineHeight: 16 }, bioInput: { minHeight: 86, textAlignVertical: "top" }, roles: { gap: 9 }, roleWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, rolePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 }, toggleRow: { borderRadius: 14, padding: 13, marginBottom: 10 }, toggleMain: { flexDirection: "row", alignItems: "center", gap: 11 }, toggleCopy: { flex: 1, minWidth: 0 }, toggleTitle: { fontSize: 14, lineHeight: 18, fontWeight: "600" }, toggleDescription: { fontSize: 12, lineHeight: 16, marginTop: 2 }, toggleError: { marginTop: 8 }, accountList: { marginTop: 12, gap: 8 }, listTitle: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }, listTitleText: { fontSize: 13, fontWeight: "600" }, emptyList: { fontSize: 13, lineHeight: 18 }, accountRow: { minHeight: 58, borderRadius: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, accountIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 }, accountName: { fontSize: 13, lineHeight: 17, fontWeight: "600" }, accountUsername: { fontSize: 11, lineHeight: 14 }, rowAction: { fontSize: 13, fontWeight: "700" }, optionGroup: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: "hidden" }, optionRow: { minHeight: 70, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }, optionCopy: { flex: 1, minWidth: 0 }, optionLabel: { fontSize: 14, lineHeight: 18, fontWeight: "600" }, optionDescription: { marginTop: 2, fontSize: 12, lineHeight: 16 }, soundSummary: { marginTop: 10 }, logout: { marginTop: 18, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 7, padding: 12 }, logoutText: { fontSize: 14, lineHeight: 18 }, });



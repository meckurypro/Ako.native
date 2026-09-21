import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

const PROFILE_ROLES_SELECT = "profile_roles(position, role:roles(id, label, sort_order))";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SOUND_ENABLED_KEY = "ako-sound-enabled";
const SOUND_MODE_KEY = "ako-sound-mode";

export type SoundMode = "normal" | "minimalist";
export type OwnProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  website_url: string | null;
  avatar_url: string | null;
  is_private: boolean;
  hide_followers_list: boolean;
  hide_following_list: boolean;
  profile_roles?: { position: number; role: { id: string; label: string; sort_order?: number } | { id: string; label: string; sort_order?: number }[] | null }[];
};
export type Role = { id: string; label: string; sort_order: number | null };
export type AccountRow = { id: string; display_name: string; username: string; avatar_url: string | null };

export function useOwnSettingsProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["own-profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<OwnProfile> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`id, username, display_name, bio, website_url, avatar_url, is_private, hide_followers_list, hide_following_list, ${PROFILE_ROLES_SELECT}`)
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data as OwnProfile;
    },
  });
}

export function useProfileVisitCount(profileId?: string) {
  return useQuery({
    queryKey: ["profile-visit-count", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
      const { count, error } = await supabase
        .from("profile_visits")
        .select("visitor_id", { count: "exact", head: true })
        .eq("visited_id", profileId!)
        .gte("visited_at", cutoff);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async (): Promise<Role[]> => {
      const { data, error } = await supabase.from("roles").select("id, label, sort_order").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Role[];
    },
    staleTime: 1000 * 60 * 60,
  });
}

export function useUpdateSettingsProfile() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { display_name?: string; username?: string; bio?: string | null; website_url?: string | null; avatar_url?: string | null }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update(input).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["own-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
      ]);
    },
  });
}

export function useUpdateProfileRoles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roleIds: string[]) => {
      if (!user) throw new Error("Not signed in");
      if (roleIds.length > 3) throw new Error("You can select up to 3 job/hobby tags.");
      const { error } = await supabase.rpc("set_profile_roles", { p_role_ids: roleIds });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["own-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useUsernameAvailability(username: string, currentUsername?: string, userId?: string) {
  const normalized = username.trim().toLowerCase();
  return useQuery({
    queryKey: ["username-availability", normalized, userId],
    enabled: !!userId && normalized.length >= 3 && normalized !== (currentUsername ?? "").toLowerCase(),
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id").eq("username", normalized).neq("id", userId!).maybeSingle();
      if (error) throw error;
      return !data;
    },
    staleTime: 1000 * 20,
  });
}

function useTogglePrivacyField(field: "is_private" | "hide_followers_list" | "hide_following_list") {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (value: boolean) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update({ [field]: value }).eq("id", user.id);
      if (error) throw error;
      return value;
    },
    onMutate: async (value) => {
      const queryKey = ["own-profile", user?.id];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => old ? { ...old, [field]: value } : old);
      return { previous, queryKey };
    },
    onError: (_error, _value, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(context.queryKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["own-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useTogglePrivateAccount() { return useTogglePrivacyField("is_private"); }
export function useToggleHideFollowersList() { return useTogglePrivacyField("hide_followers_list"); }
export function useToggleHideFollowingList() { return useTogglePrivacyField("hide_following_list"); }

export function useBlockedList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["blocked-list", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AccountRow[]> => {
      const { data, error } = await supabase.from("blocked_users").select("blocked:profiles!blocked_users_blocked_id_fkey(id, display_name, username, avatar_url)").eq("blocker_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.blocked).filter(Boolean);
    },
  });
}

export function useMutedList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["muted-list", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AccountRow[]> => {
      const { data, error } = await supabase.from("muted_users").select("muted:profiles!muted_users_muted_id_fkey(id, display_name, username, avatar_url)").eq("muter_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.muted).filter(Boolean);
    },
  });
}

export function useUnblockAccount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (blockedId: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("blocked_users").delete().eq("blocker_id", user.id).eq("blocked_id", blockedId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["blocked-list"] }),
  });
}

export function useUnmuteAccount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mutedId: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("muted_users").delete().eq("muter_id", user.id).eq("muted_id", mutedId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["muted-list"] }),
  });
}

export function useChangePassword() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      if (!user?.email) throw new Error("Not signed in");
      const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (authError) throw new Error("Current password is incorrect.");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
  });
}

export function useDeactivateAccount() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("deactivate-account");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
  });
}

export function useSoundSettings() {
  const [enabled, setEnabledState] = useState(true);
  const [mode, setModeState] = useState<SoundMode>("normal");
  useEffect(() => {
    let alive = true;
    void Promise.all([SecureStore.getItemAsync(SOUND_ENABLED_KEY), SecureStore.getItemAsync(SOUND_MODE_KEY)]).then(([storedEnabled, storedMode]) => {
      if (!alive) return;
      if (storedEnabled === "false") setEnabledState(false);
      if (storedMode === "normal" || storedMode === "minimalist") setModeState(storedMode);
    });
    return () => { alive = false; };
  }, []);
  const setEnabled = useCallback(async (value: boolean) => {
    setEnabledState(value);
    await SecureStore.setItemAsync(SOUND_ENABLED_KEY, String(value));
  }, []);
  const setMode = useCallback(async (value: SoundMode) => {
    setModeState(value);
    await SecureStore.setItemAsync(SOUND_MODE_KEY, value);
  }, []);
  return { enabled, setEnabled, mode, setMode };
}

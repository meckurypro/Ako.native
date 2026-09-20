// File: hooks/useProfile.ts
//
// Only useMyProfile so far — the rest of web's useProfile.ts (user posts,
// follow state, etc.) ports with the Profile screen.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export interface MyProfileSummary {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export function useMyProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async (): Promise<MyProfileSummary> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

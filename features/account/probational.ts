// File: features/account/probational.ts
//
// Mirrors web's src/hooks/useProbationalAccess.ts. Client-side helper
// for the probational (pending-review) partial-access system — see
// the probational_partial_access DB migration and fn_can_access_feature
// (shared Supabase project, same backend as the web app). A pending
// account gets full navigation into the app (see app/_layout.tsx);
// individual pages/actions are locked per-feature instead, each
// behind its own probational_*_enabled row in feature_flags
// (admin-toggleable from the web app's Admin > Feature flags >
// Probational users — there's no native admin surface).
//
// This is the UX layer only — the real enforcement for follow/
// message/react lives in RLS, and for post/comment in the
// create-post/create-comment edge functions.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAccountAccess } from "./api";

export type ProbationalFlagMap = Record<string, boolean>;

// Separate query from web's generic useFeatureFlags (features/wallet/api.ts)
// so the default-when-missing behavior can differ: every probational_*
// row is seeded by the migration, but if one's ever missing this must
// default LOCKED, not open — the opposite of the wallet hook's default.
function useProbationalFlags() {
  return useQuery({
    queryKey: ["feature-flags"],
    staleTime: 60_000,
    queryFn: async (): Promise<ProbationalFlagMap> => {
      const { data, error } = await supabase.from("feature_flags").select("key, enabled");
      if (error) throw error;
      const map: ProbationalFlagMap = {};
      for (const row of data ?? []) map[row.key] = row.enabled;
      return map;
    },
  });
}

/** True only for a pending account while the review gate is on. */
export function useIsProbational(): boolean {
  const { data } = useAccountAccess();
  return !!data?.isProbational;
}

/**
 * Whether a given probational_*_enabled feature is locked for the
 * CURRENT user right now. Always false for an approved user (or
 * anyone once the gate is off) — the lock only ever applies to a
 * probational account.
 */
export function useProbationalLock(featureKey: string): boolean {
  const isProbational = useIsProbational();
  const { data } = useProbationalFlags();
  const featureEnabled = data?.[featureKey] ?? false;
  return isProbational && !featureEnabled;
}

/**
 * Whether the "+" Create entry point has nothing to offer a
 * probational user right now — i.e. both Post and Create project are
 * locked. Used to hide the "+" itself rather than send someone into
 * an empty create sheet. Always false for anyone not probational.
 */
export function useCreateEntirelyLocked(): boolean {
  const postLocked = useProbationalLock("probational_post_enabled");
  const createProjectLocked = useProbationalLock("probational_create_project_enabled");
  return postLocked && createProjectLocked;
}

// File: components/OnboardingGate.tsx
//
// Native stand-in for the onboarding half of web's RequireAuth: "incomplete
// onboarding never reaches the main app, however the route was reached".
// Web wraps every protected route; native has no per-route wrapper, so this
// renders once in the root layout and redirects from anywhere that isn't an
// auth or onboarding screen.
//
// Same destination logic as web: someone who already saved interests
// resumes at Find People, everyone else starts at Welcome.
//
// Not covered here (still open, same as before): RequireAuth's signed-out
// bounce for the main app and its account-under-review gate
// (useAccountAccess / AccountUnderReview) — separate slices.
import { useEffect } from "react";
import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { useAuth } from "../hooks/useAuth";
import { useOnboardingStatus } from "../hooks/useOnboarding";

// "/" is index.tsx's job (it redirects with the same rule).
const EXEMPT_EXACT = new Set(["/", "/login", "/signup", "/verify-email", "/reset-password", "/auth/callback"]);

function isExempt(pathname: string) {
  return EXEMPT_EXACT.has(pathname) || pathname.startsWith("/onboarding/");
}

export function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const navState = useRootNavigationState();
  const { user } = useAuth();
  const { data: onboarding } = useOnboardingStatus();

  useEffect(() => {
    // Navigating before the root navigator has mounted throws.
    if (!navState?.key) return;
    if (!user || !onboarding || onboarding.completed) return;
    if (isExempt(pathname)) return;

    router.replace(onboarding.hasInterests ? "/onboarding/people" : "/onboarding/welcome");
  }, [navState?.key, user, onboarding, pathname, router]);

  return null;
}

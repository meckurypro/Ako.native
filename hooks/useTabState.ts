// File: hooks/useTabState.ts
//
// Native counterpart to web's useTabState — same signature, so screens port
// over unchanged: `const [tab, setTab] = useTabState(KEYS, "for-you")`.
//
// Web keeps the selection in the URL (`?tab=projects`) so a refresh lands
// back on the same tab and shared links can pre-select one. Native has no
// refresh, so the selection lives in component state; the route param is
// still honored as the *starting* tab (deep links like ako://feed?tab=following)
// and again whenever a navigation changes it while the screen is mounted.
// An unrecognized or missing value falls back to `defaultValue`.
import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";

export function useTabState<T extends string>(
  values: readonly T[],
  defaultValue: T,
  paramName: string = "tab"
): [T, (next: T) => void] {
  const params = useLocalSearchParams();
  const rawParam = params[paramName];
  const raw = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  const fromParam = raw !== undefined && (values as readonly string[]).includes(raw) ? (raw as T) : null;

  const [tab, setTab] = useState<T>(fromParam ?? defaultValue);

  useEffect(() => {
    if (fromParam) setTab(fromParam);
  }, [fromParam]);

  return [tab, setTab];
}

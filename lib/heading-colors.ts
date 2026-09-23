// Native port of web's src/lib/headingColors.ts. Posts store only the
// key below (posts.heading_color), never a raw hex, so entries here can
// be re-tuned later without touching a single stored post. Each color is
// a light/dark pair — see web's file for the full contrast-ratio notes;
// kept in sync here.

export type HeadingColorDef = { key: string; label: string; light: string; dark: string };

export const HEADING_COLORS: HeadingColorDef[] = [
  // Same value as the original single default (--color-post-header) —
  // kept first, and the fallback null/undefined maps to.
  { key: "sapphire", label: "Sapphire", light: "#1E4C9A", dark: "#7CB3FF" },
  { key: "emerald", label: "Emerald", light: "#08633F", dark: "#4FE0A8" },
  { key: "amber", label: "Amber", light: "#7A4A00", dark: "#F2B84D" },
  { key: "garnet", label: "Garnet", light: "#7A1140", dark: "#E893BE" },
  { key: "amethyst", label: "Amethyst", light: "#5B3A8A", dark: "#C6A6F0" },
  { key: "petrol", label: "Petrol", light: "#0E5F63", dark: "#5FD6DC" },
  { key: "espresso", label: "Espresso", light: "#5C3A1E", dark: "#D9A876" },
  { key: "graphite", label: "Graphite", light: "#2B2B2E", dark: "#DAD6CC" },
];

const HEADING_COLOR_MAP: Record<string, HeadingColorDef> = Object.fromEntries(HEADING_COLORS.map((c) => [c.key, c]));

export function getHeadingColorDef(key: string | null | undefined): HeadingColorDef | null {
  if (!key) return null;
  return HEADING_COLOR_MAP[key] ?? null;
}

export function getHeadingColorHex(key: string | null | undefined, isDark: boolean): string {
  const def = getHeadingColorDef(key);
  if (def) return isDark ? def.dark : def.light;
  const fallback = HEADING_COLOR_MAP.sapphire;
  return isDark ? fallback.dark : fallback.light;
}

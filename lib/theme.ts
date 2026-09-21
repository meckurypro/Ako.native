// File: lib/theme.ts
//
// Ports the design tokens from web's src/index.css (@theme + .dark block)
// to plain JS objects RN can consume. Web reads these as Tailwind
// utilities (bg-canvas, text-ink-muted, etc); RN has no CSS cascade, so
// every component instead calls useTheme() and reads colors.* directly.
//
// Only the tokens actually used by ported components are here so far —
// add more from src/index.css's @theme block as more screens get ported.
import { useColorScheme } from "react-native";

export const lightColors = {
  canvas: "#F7F4EF",
  surface: "#FDFBF6",
  ink: "#1F1D1A",
  inkMuted: "#6B675F",
  accent: "#3D5A45",
  accentHover: "#2F4636",
  accentSoft: "#E3E9E1",
  border: "#E9E4D8",
  danger: "#A64B3F",
  // Muted warm gold/ochre — the Pushback stance, and FollowButton's
  // "follow back" tint. Web's --color-pushback.
  pushback: "#B8862E",
  // Saturated sage for the few spots that need to pop against a list
  // (jump-to-post flash, unread rows) — web's --color-highlight.
  highlight: "#BFE6C6",
  // Post heading color (PostContent.tsx) — its own token, not a reuse
  // of accent (sage, would read as a link/action color here). Web's
  // --color-post-header.
  postHeader: "#1E4C9A",
};

export const darkColors = {
  canvas: "#0C0C0B",
  surface: "#131311",
  ink: "#F9F8F5",
  inkMuted: "#ADA99E",
  accent: "#4CAE7C",
  accentHover: "#63C695",
  accentSoft: "#17281F",
  border: "#232220",
  danger: "#C97C6B",
  pushback: "#D9A857",
  highlight: "#1E4B31",
  // Dark-mode counterpart to light mode's #1E4C9A — that navy is far
  // too dark against near-black canvas, so this swaps to a light
  // sky-blue instead. Web's dark --color-post-header.
  postHeader: "#7CB3FF",
};

export type ThemeColors = typeof lightColors;

// Overlay chrome — every dismissible surface (Modal, DropdownMenu, and
// anything built on either). Deliberately theme-INDEPENDENT, exactly as on
// web (--color-overlay-* in @theme, untouched by .dark): a fixed dark-glass
// panel with light text, so a confirmation or kebab menu looks the same in
// light and dark mode. Hence a plain constant rather than part of the
// light/dark palettes above.
export const overlayColors = {
  surface: "#1C1C1E",
  surfaceRaised: "#2C2C2E",
  ink: "#F5F5F7",
  inkMuted: "#98989D",
  border: "#FFFFFF1F", // ~12% white hairline
  danger: "#D6968A",
  dangerSoft: "#4A2E2A",
  accent: "#8FB89C",
  accentSoft: "#263831",
} as const;

// Web's dark mode is a user-toggled `.dark` class on <html> (see
// useTheme.tsx there), not the OS setting — this native version only
// has the OS scheme to go on for now. If/when an in-app theme toggle
// gets ported, swap this for a context provider the same way.
export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { colors: isDark ? darkColors : lightColors, isDark, scheme: scheme ?? "light" };
}

// Small helper for the ink-muted/20, ink-muted/45 etc opacity variants
// web gets for free from Tailwind's color/opacity utilities. RN accepts
// 8-digit #RRGGBBAA hex directly, so this just appends the alpha byte.
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

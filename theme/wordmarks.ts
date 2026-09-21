// File: theme/wordmarks.ts
//
// The AKọ wordmark PNGs, keyed by the THEME they are drawn for — not by the
// colour of the file. `light` is the dark-green wordmark for light backgrounds;
// `dark` is the bright-green one for dark backgrounds. Use
// `wordmarks[isDark ? "dark" : "light"]` everywhere so a header can't pair the
// wrong variant with a theme (Discover had them swapped, at ~2–3:1 contrast in
// both modes, when each screen kept its own LOGO_DARK / LOGO_LIGHT constants).
export const wordmarks = {
  light: require("@/assets/images/app-icon-light-without-tagline.png"),
  dark: require("@/assets/images/app-icon-dark-without-tagline.png"),
} as const;

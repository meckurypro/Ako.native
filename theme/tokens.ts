import { fonts } from "./fonts";

export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;
export const radii = { sm: 8, md: 14, lg: 20, xl: 28, full: 999 } as const;
export const iconSizes = { sm: 16, md: 21, lg: 26, xl: 32 } as const;
export const motion = { instant: 100, fast: 160, normal: 240, slow: 360 } as const;
// Family assignment follows web's split: display/title/heading are
// the "headline/identity moment" sizes web dresses in Playfair
// Display (font-display); body/label/caption are the UI/body text
// web leaves on the default Inter (font-body). fontWeight is
// deliberately omitted here — each family entry below is already a
// specific weight-cut font file, and pairing that with a numeric
// fontWeight is what makes Android fake-bold it on top.
export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontFamily: fonts.display.bold, letterSpacing: -0.8 },
  title: { fontSize: 24, lineHeight: 30, fontFamily: fonts.display.bold, letterSpacing: -0.35 },
  heading: { fontSize: 18, lineHeight: 24, fontFamily: fonts.display.bold },
  body: { fontSize: 16, lineHeight: 23, fontFamily: fonts.body.regular },
  label: { fontSize: 14, lineHeight: 19, fontFamily: fonts.body.semibold },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fonts.body.medium },
} as const;

export const lightColors = {
  background: "#F7F4EF", surface: "#FDFBF6", surfaceElevated: "#FFFFFF", border: "#E9E4D8",
  text: "#1F1D1A", textSecondary: "#6B675F", textMuted: "#918C82", accent: "#3D5A45",
  accentPressed: "#2F4636", accentSoft: "#E3E9E1", success: "#2F7D50", warning: "#B8862E",
  danger: "#A64B3F", info: "#1E4C9A", unread: "#BFE6C6", presence: "#39C568",
  overlay: "rgba(31,29,26,0.48)", skeleton: "#E8E3D9", onAccent: "#FFFFFF",
} as const;

export const darkColors = {
  background: "#0C0C0B", surface: "#131311", surfaceElevated: "#1C1C19", border: "#2A2925",
  text: "#F9F8F5", textSecondary: "#ADA99E", textMuted: "#7C786F", accent: "#4CAE7C",
  accentPressed: "#63C695", accentSoft: "#17281F", success: "#63C695", warning: "#D9A857",
  danger: "#C97C6B", info: "#7CB3FF", unread: "#1E4B31", presence: "#39FF6A",
  overlay: "rgba(0,0,0,0.68)", skeleton: "#24231F", onAccent: "#07150D",
} as const;

export type ThemeColors = { [K in keyof typeof lightColors]: string };

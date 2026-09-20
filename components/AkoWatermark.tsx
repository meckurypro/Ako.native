// File: components/AkoWatermark.tsx
// Port of web's src/components/AkoWatermark.tsx.
//
// Subtle branding mark in a post card's top-right corner — the point of
// it is purely for screenshots: when someone shares a post outside the
// app, this is the only thing that still says "Akọ" in the image.
//
// Uses the same assets/images/app_icon_*_without_tagline.png wordmarks
// as Wordmark.tsx (already theme-paired: "dark" tuned bright for a dark
// card background, "light" tuned muted for a light one). Web swaps
// between the two with a CSS `dark:` variant on two stacked <img>s; RN
// has no such variant, so this follows Wordmark's pattern instead —
// useTheme()'s `isDark` picks the one `require`d source, rendered once.
//
// Sized to sit roughly level with the Follow pill's own footprint
// (web: h-5, ~20px tall) rather than the full-size app icon.
//
// PostCard is responsible for when NOT to render this — skipped on
// archived-frozen cards (Restore/Delete already own that corner) and on
// a plain reshare (RepostBadge already owns it there).
import { Image, StyleSheet } from "react-native";
import { useTheme } from "../lib/theme";

export function AkoWatermark() {
  const { isDark } = useTheme();

  const source = isDark
    ? require("../assets/images/app_icon_dark_without_tagline.png")
    : require("../assets/images/app_icon_light_without_tagline.png");

  return (
    <Image
      source={source}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={styles.mark}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  mark: { height: 20, width: 48, opacity: 0.9 },
});

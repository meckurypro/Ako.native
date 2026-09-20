// File: components/Wordmark.tsx
import { View, Image, StyleSheet } from "react-native";
import { useTheme } from "../lib/theme";

interface WordmarkProps {
  size?: "sm" | "lg";
}

// Web used two <img> tags toggled by a CSS dark: variant. RN has no CSS
// media-query equivalent — useTheme()'s scheme + a plain if/else is the
// direct replacement.
export function Wordmark({ size = "lg" }: WordmarkProps) {
  const { isDark } = useTheme();
  const height = size === "lg" ? 96 : 36;

  const source =
    isDark
      ? require("../assets/images/app_icon_dark_without_tagline.png")
      : require("../assets/images/app_icon_light_without_tagline.png");

  return (
    <View style={styles.wrap}>
      <Image source={source} style={{ height, width: height * 2.4 }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
});

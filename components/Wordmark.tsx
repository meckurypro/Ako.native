// File: components/Wordmark.tsx
import { View, Image, useColorScheme, StyleSheet } from "react-native";

interface WordmarkProps {
  size?: "sm" | "lg";
}

// Web used two <img> tags toggled by a CSS dark: variant. RN has no CSS
// media-query equivalent — useColorScheme() + a plain if/else is the
// direct replacement.
export function Wordmark({ size = "lg" }: WordmarkProps) {
  const scheme = useColorScheme();
  const height = size === "lg" ? 96 : 36;

  // FLAG: these two PNGs need to exist in your Expo project's
  // assets folder (e.g. assets/images/) — copy them over from
  // public/app_icon_light_without_tagline.png and the dark variant.
  const source =
    scheme === "dark"
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

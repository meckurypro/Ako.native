// theme/fonts.ts
//
// Mirrors web's three-family system (src/index.css --font-display /
// --font-body / --font-simple):
//   - display (Playfair Display): headline/identity moments — big
//     titles, section headers. Web calls this "font-display" and
//     applies it across nearly every page/sheet title.
//   - body (Inter): the actual default — web sets this on <body>,
//     everything not explicitly opted into display/simple reads this.
//   - simple (Roboto): a deliberate, narrow exception — web uses this
//     ONLY for the post-card author name and the post heading
//     (PostCard.tsx / PostContent.tsx), replacing what used to be a
//     Playfair Display treatment there. Keep it that narrow here too;
//     don't reach for `simple` anywhere else without checking web first.
//
// Font files ship via @expo-google-fonts/* (bundled TTFs, no network
// fetch at runtime) rather than trying to load Google's web-font CDN,
// which isn't reachable from a published app anyway.
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_800ExtraBold,
  PlayfairDisplay_900Black,
} from "@expo-google-fonts/playfair-display";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
  Roboto_700Bold,
} from "@expo-google-fonts/roboto";

// Passed straight to expo-font's useFonts() in app/_layout.tsx.
export const fontAssets = {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_800ExtraBold,
  PlayfairDisplay_900Black,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
  Roboto_700Bold,
} as const;

// Weight-specific family names — RN needs the exact loaded key here,
// not a base family name + numeric fontWeight (that combination is
// what causes Android's synthetic-bold double-up with custom fonts).
// Anywhere one of these is used, leave fontWeight off the style.
export const fonts = {
  display: {
    regular: "PlayfairDisplay_400Regular",
    medium: "PlayfairDisplay_500Medium",
    semibold: "PlayfairDisplay_600SemiBold",
    bold: "PlayfairDisplay_700Bold",
    extrabold: "PlayfairDisplay_800ExtraBold",
    black: "PlayfairDisplay_900Black",
  },
  body: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
  },
  simple: {
    regular: "Roboto_400Regular",
    medium: "Roboto_500Medium",
    semibold: "Roboto_600SemiBold",
    bold: "Roboto_700Bold",
  },
} as const;

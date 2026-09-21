import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Appearance, Platform, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { darkColors, lightColors, motion, radii, spacing, typography, type ThemeColors } from "@/theme";

export type ThemePreference = "light" | "dark" | "system";
type ThemeValue = {
  preference: ThemePreference;
  isDark: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  motion: typeof motion;
  setPreference: (value: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeValue | null>(null);
const THEME_KEY = "ako-theme-preference";

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const isDark = preference === "system" ? systemScheme === "dark" : preference === "dark";
  useEffect(() => {
    if (Platform.OS === "web") return;
    void SecureStore.getItemAsync(THEME_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") setPreferenceState(stored);
    });
  }, []);
  const setPreference = useCallback(async (value: ThemePreference) => {
    setPreferenceState(value);
    if (Platform.OS !== "web") await SecureStore.setItemAsync(THEME_KEY, value);
    if (value !== "system") Appearance.setColorScheme(value);
  }, []);
  const value = useMemo<ThemeValue>(() => ({
    preference, isDark, colors: isDark ? darkColors : lightColors, spacing, radii, typography, motion, setPreference,
  }), [preference, isDark, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

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
  // Web has no SecureStore round-trip, so it's hydrated on the very first
  // render. Native starts un-hydrated and stays that way — provider renders
  // null, below — until the stored preference has actually been read. The
  // native splash screen (preventAutoHideAsync in app/_layout.tsx) is still
  // up while that happens, so there's no flash of the wrong theme: nothing
  // in the app tree mounts, so app/_layout.tsx's onLayout/hideAsync() can't
  // fire early either.
  const [isHydrated, setIsHydrated] = useState(Platform.OS === "web");
  const isDark = preference === "system" ? systemScheme === "dark" : preference === "dark";

  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    void SecureStore.getItemAsync(THEME_KEY).then((stored) => {
      if (cancelled) return;
      const resolved: ThemePreference = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
      setPreferenceState(resolved);
      // Apply the restored preference to the OS immediately, not only on the
      // next explicit setPreference() call — otherwise native components
      // (keyboard, alerts, context menus) stay on whatever the OS defaulted
      // to until the user next changes the setting.
      Appearance.setColorScheme(resolved === "system" ? null : resolved);
      setIsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback(async (value: ThemePreference) => {
    setPreferenceState(value);
    if (Platform.OS !== "web") await SecureStore.setItemAsync(THEME_KEY, value);
    // "system" must hand control back to the OS (null), not just stop
    // calling setColorScheme — otherwise a prior forced light/dark choice
    // keeps overriding native components even after the user picks "system".
    Appearance.setColorScheme(value === "system" ? null : value);
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({
      preference,
      isDark,
      colors: isDark ? darkColors : lightColors,
      spacing,
      radii,
      typography,
      motion,
      setPreference,
    }),
    [preference, isDark, setPreference],
  );

  if (!isHydrated) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

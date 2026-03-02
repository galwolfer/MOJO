/**
 * ThemeContext
 *
 * Provides theme mode (light/dark) state across the app.
 * Integrates with accessibility preferences to persist theme selection.
 * Exposes a pre-computed `colors` object so components can bind to
 * dynamic tokens without calling `getDynamicColors` themselves.
 */

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { Appearance, ColorSchemeName } from "react-native";
import { useAccessibilityPreferences, ThemeMode } from "../hooks/useAccessibilityPreferences";
import { getDynamicColors, ThemeColors } from "../theme";

/** Resolves 'system' to the actual device color scheme. */
function resolveTheme(theme: ThemeMode, systemScheme: ColorSchemeName): "light" | "dark" {
  if (theme === "system") return systemScheme === "dark" ? "dark" : "light";
  return theme;
}

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  /** The actual resolved theme ("light" or "dark"), after applying system default if needed. */
  resolvedTheme: "light" | "dark";
  /** Pre-computed dynamic color tokens for the current theme. */
  colors: ThemeColors;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { preferences, savePreferences, isLoading } = useAccessibilityPreferences();
  const [theme, setThemeState] = useState<ThemeMode>(preferences.theme);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  // Track device color scheme changes (matters when theme === 'system')
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  // Update theme when preferences load from AsyncStorage/backend
  useEffect(() => {
    if (preferences.theme) {
      setThemeState(preferences.theme);
    }
  }, [preferences.theme]);

  const setTheme = async (newTheme: ThemeMode) => {
    try {
      console.log(`[ThemeContext] setTheme() called with: ${newTheme}`);
      await savePreferences({ theme: newTheme });
      setThemeState(newTheme);
      console.log(`[ThemeContext] theme saved and state updated: ${newTheme}`);
    } catch (error) {
      console.error("[ThemeContext] Failed to save theme:", error);
      throw error;
    }
  };

  const resolvedTheme = resolveTheme(theme, systemScheme);

  // Memoize the dynamic color object — recomputes when resolved theme changes
  const colors = useMemo(() => getDynamicColors(resolvedTheme), [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, colors, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Access the full theme context (theme mode, setTheme, colors, isLoading).
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

/**
 * Convenience hook – returns only the dynamic color tokens for the current theme.
 * Preferred shorthand for components that just need colors.
 */
export const useColors = (): ThemeColors => {
  return useTheme().colors;
};

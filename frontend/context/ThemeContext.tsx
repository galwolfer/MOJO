/**
 * ThemeContext
 *
 * Provides theme mode (light/dark) state across the app.
 * Integrates with accessibility preferences to persist theme selection.
 * Exposes a pre-computed `colors` object so components can bind to
 * dynamic tokens without calling `getDynamicColors` themselves.
 */

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { useAccessibilityPreferences, ThemeMode } from "../hooks/useAccessibilityPreferences";
import { getDynamicColors, ThemeColors } from "../theme";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  /** Pre-computed dynamic color tokens for the current theme. */
  colors: ThemeColors;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { preferences, savePreferences, isLoading } = useAccessibilityPreferences();
  const [theme, setThemeState] = useState<ThemeMode>(preferences.theme || "light");

  // Update theme when preferences change
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

  // Memoize the dynamic color object so consumers don't re-render unless theme truly changes
  const colors = useMemo(() => getDynamicColors(theme), [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme, colors, isLoading }}>{children}</ThemeContext.Provider>;
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

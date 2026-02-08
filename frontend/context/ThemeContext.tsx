/**
 * ThemeContext
 *
 * Provides theme mode (light/dark) state across the app.
 * Integrates with accessibility preferences to persist theme selection.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAccessibilityPreferences, ThemeMode } from "../hooks/useAccessibilityPreferences";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
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

  return <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

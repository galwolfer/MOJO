/**
 * AccessibilityContext
 *
 * Single source of truth for accessibility preferences (time format, theme).
 * Wrapping the app with <AccessibilityProvider> ensures every call to
 * useAccessibilityPreferences() reads & writes the same shared state,
 * so changing the time format in Settings is immediately reflected in
 * TimeDisplay, TimeRangeDisplay, and any other consumer.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserPreferences, updateAppSettings } from "../services/apiClient";
import { useAuth } from "./AuthContext";

export const ACCESSIBILITY_PREFS_KEY = "@mojo/accessibility-preferences";

export type TimeFormat = "12h" | "24h";
export type ThemeMode = "light" | "dark" | "system";

export interface AccessibilityPreferences {
  timeFormat: TimeFormat;
  theme: ThemeMode;
}

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  timeFormat: "12h",
  theme: "system",
};

interface AccessibilityContextValue {
  preferences: AccessibilityPreferences;
  isLoading: boolean;
  error: string | null;
  setTimeFormat: (format: TimeFormat) => Promise<void>;
  savePreferences: (partial: Partial<AccessibilityPreferences>) => Promise<void>;
  loadPreferences: () => Promise<void>;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Step 1: Apply cached preferences immediately so UI doesn't flash
      const stored = await AsyncStorage.getItem(ACCESSIBILITY_PREFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AccessibilityPreferences;
        setPreferences(parsed);
      }

      // Step 2: Fetch from backend and reconcile
      if (token) {
        try {
          const response = await getUserPreferences();
          console.debug("[AccessibilityContext] getUserPreferences response:", response);
          const accessibilitySettings = response.appSettings?.accessibility as AccessibilityPreferences | undefined;
          console.debug("[AccessibilityContext] fetched accessibility:", accessibilitySettings);

          if (accessibilitySettings) {
            setPreferences(accessibilitySettings);
            await AsyncStorage.setItem(ACCESSIBILITY_PREFS_KEY, JSON.stringify(accessibilitySettings));
          }
        } catch (backendError) {
          console.warn("[AccessibilityContext] Failed to fetch from backend, using local cache:", backendError);
        }
      }
    } catch (err) {
      console.error("[AccessibilityContext] Failed to load preferences:", err);
      setError("Failed to load accessibility preferences");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const savePreferences = useCallback(
    async (newPreferences: Partial<AccessibilityPreferences>) => {
      try {
        setError(null);
        const updated = { ...preferences, ...newPreferences };
        console.debug("[AccessibilityContext] saving preferences:", updated);

        // Optimistically update the shared state immediately so all consumers re-render
        setPreferences(updated);

        if (token) {
          try {
            console.debug("[AccessibilityContext] calling updateAppSettings with:", { accessibility: updated });
            await updateAppSettings({ accessibility: updated });
            console.debug("[AccessibilityContext] updateAppSettings succeeded");
          } catch (backendError) {
            console.warn("[AccessibilityContext] Failed to save to backend:", backendError);
            throw backendError;
          }
        }

        await AsyncStorage.setItem(ACCESSIBILITY_PREFS_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error("[AccessibilityContext] Failed to save preferences:", err);
        setError("Failed to save accessibility preferences");
        throw err;
      }
    },
    [preferences, token],
  );

  const setTimeFormat = useCallback(
    async (format: TimeFormat) => {
      await savePreferences({ timeFormat: format });
    },
    [savePreferences],
  );

  // Load on mount and whenever auth token changes (e.g. after login)
  // CRITICAL: Always fetch from backend on mount to ensure we have latest saved prefs
  useEffect(() => {
    loadPreferences();
  }, [token]);

  return (
    <AccessibilityContext.Provider
      value={{ preferences, isLoading, error, setTimeFormat, savePreferences, loadPreferences }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibilityContext(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error("useAccessibilityContext must be used inside <AccessibilityProvider>");
  }
  return ctx;
}

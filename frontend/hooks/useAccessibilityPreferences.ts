/**
 * useAccessibilityPreferences
 *
 * Manages accessibility preferences like time format (12-hour vs 24-hour).
 * Preferences are stored in the user's profile on the backend (profile.settings.accessibility)
 * and cached locally in AsyncStorage for offline support.
 */

import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserPreferences, updateAppSettings } from "../services/apiClient";
import { useAuth } from "../context/AuthContext";

const ACCESSIBILITY_PREFS_KEY = "@mojo/accessibility-preferences";

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

export function useAccessibilityPreferences() {
  const { token } = useAuth();
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences — AsyncStorage first (fast/offline), then update from backend
  const loadPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Step 1: Apply cached preferences immediately so theme doesn't flash
      const stored = await AsyncStorage.getItem(ACCESSIBILITY_PREFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AccessibilityPreferences;
        setPreferences(parsed);
      }

      // Step 2: Fetch from backend and update if we have a token
      if (token) {
        try {
          const response = await getUserPreferences();
          const accessibilitySettings = response.appSettings?.accessibility as AccessibilityPreferences | undefined;

          if (accessibilitySettings) {
            setPreferences(accessibilitySettings);
            // Keep local cache in sync with backend
            await AsyncStorage.setItem(ACCESSIBILITY_PREFS_KEY, JSON.stringify(accessibilitySettings));
          }
        } catch (backendError) {
          console.warn("[useAccessibilityPreferences] Failed to fetch from backend, using local cache:", backendError);
        }
      }
    } catch (err) {
      console.error("[useAccessibilityPreferences] Failed to load preferences:", err);
      setError("Failed to load accessibility preferences");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Save preferences to backend and AsyncStorage
  const savePreferences = useCallback(
    async (newPreferences: Partial<AccessibilityPreferences>) => {
      try {
        setError(null);
        const updated = { ...preferences, ...newPreferences };

        if (token) {
          // Save to backend
          try {
            await updateAppSettings({
              accessibility: updated,
            });
          } catch (backendError) {
            console.warn("[useAccessibilityPreferences] Failed to save to backend:", backendError);
            throw backendError;
          }
        }

        // Also cache locally
        await AsyncStorage.setItem(ACCESSIBILITY_PREFS_KEY, JSON.stringify(updated));
        setPreferences(updated);
      } catch (err) {
        console.error("[useAccessibilityPreferences] Failed to save preferences:", err);
        setError("Failed to save accessibility preferences");
        throw err;
      }
    },
    [preferences, token],
  );

  // Update time format
  const setTimeFormat = useCallback(
    async (format: TimeFormat) => {
      await savePreferences({ timeFormat: format });
    },
    [savePreferences],
  );

  // Initialize preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return {
    preferences,
    isLoading,
    error,
    setTimeFormat,
    savePreferences,
    loadPreferences,
  };
}

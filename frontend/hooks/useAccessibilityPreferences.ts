/**
 * useAccessibilityPreferences
 *
 * Thin wrapper around AccessibilityContext so all consumers share the
 * same preference state — changing the format in Settings instantly
 * updates every TimeDisplay / TimeRangeDisplay in the app.
 */

export type { TimeFormat, ThemeMode, AccessibilityPreferences } from "../context/AccessibilityContext";
export { useAccessibilityContext as useAccessibilityPreferences } from "../context/AccessibilityContext";

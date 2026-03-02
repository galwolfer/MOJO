/**
 * TimeDisplay
 *
 * A reusable time display component that respects the user's global time
 * format preference (12-hour vs 24-hour) from `useAccessibilityPreferences`.
 *
 * - Size is always "notes" (FONT_SIZES.sm)
 * - Color is always `colors.gray1`
 * - 24h mode: renders "14:30" in a single text run
 * - 12h mode: renders "2:30" at notes size + " AM"/"PM" at ~75% of that size
 *
 * Accepts either:
 *  - `isoString` – an ISO datetime string (parsed with format-awareness)
 *  - `time` + `ampm` – already-parsed parts (12h strings; ampm is hidden in 24h mode)
 */

import React from "react";
import { Text, StyleSheet, StyleProp, TextStyle } from "react-native";
import { FONT_SIZES, TYPOGRAPHY, FONTS } from "../../theme";
import { useColors } from "../../context/ThemeContext";
import { useAccessibilityPreferences } from "../../hooks/useAccessibilityPreferences";
import { getTimeParts } from "../widgets/taskHelpers";

export interface TimeDisplayProps {
  /**
   * ISO datetime string.  Parsed using the current time format preference.
   * Takes precedence over `time`/`ampm` when both are supplied.
   */
  isoString?: string;
  /**
   * Pre-parsed time part (e.g. "9:00").  Used only when `isoString` is absent.
   * In 24h mode the value is shown as-is (callers should strip AM/PM before
   * passing it here when they already have both parts).
   */
  time?: string;
  /**
   * Pre-parsed AM/PM part (e.g. "AM").  Shown only in 12h mode, at a smaller
   * font size.  Ignored in 24h mode.
   */
  ampm?: string;
  /** Optional extra styles applied to the outer Text node. */
  style?: StyleProp<TextStyle>;
}

/**
 * TimeDisplay — renders a single point in time, format-aware and always
 * styled with the app's "notes" typography and `colors.gray1`.
 */
const TimeDisplay: React.FC<TimeDisplayProps> = ({ isoString, time: timeProp, ampm: ampmProp, style }) => {
  const colors = useColors();
  const { preferences } = useAccessibilityPreferences();
  const is24h = preferences.timeFormat === "24h";

  // Resolve time parts: ISO string takes precedence
  let time: string;
  let ampm: string;

  if (isoString) {
    const parts = getTimeParts(isoString, preferences.timeFormat);
    time = parts.time;
    ampm = parts.ampm;
  } else {
    time = timeProp ?? "";
    // In 24h mode discard any pre-parsed AM/PM
    ampm = is24h ? "" : (ampmProp ?? "");
  }

  const gray1 = colors.gray1;

  return (
    <Text style={[styles.timeText, { color: gray1 }, style]}>
      {time || "—"}
      {!is24h && ampm ? <Text style={[styles.ampmText, { color: gray1 }]}>{" " + ampm}</Text> : null}
    </Text>
  );
};

export default TimeDisplay;

const styles = StyleSheet.create({
  timeText: {
    fontFamily: FONTS.fredokaLight,
    fontSize: FONT_SIZES.sm,
    // Rely on parent for alignment; don't add extra spacing here
  },
  ampmText: {
    // Slightly smaller than the time number so it reads as a suffix
    fontSize: FONT_SIZES.sm * 0.5,
    fontFamily: FONTS.fredokaLight,
  },
});

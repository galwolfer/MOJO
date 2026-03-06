/**
 * TimeRangePicker
 *
 * A "Start → End" time selector that pairs two TimePicker drums with a
 * right-arrow icon in between. Shares the same cross-platform drum-scroll
 * approach as `TimePicker`, reading 12h / 24h preference from
 * `AccessibilityContext`.
 *
 * All values are "HH:MM" in 24-hour format — the display is auto-formatted.
 *
 * Usage
 * ─────
 * <TimeRangePicker
 *   startTime="09:00"
 *   endTime="10:30"
 *   onStartChange={(v) => setStart(v)}
 *   onEndChange={(v) => setEnd(v)}
 * />
 */

import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { moderateScale } from "react-native-size-matters";
import { COLORS, FONT_SIZES, FONTS, ICON_SIZES, SPACING } from "../../theme";
import AppText from "../common/AppText";
import { ICONS } from "../icons/icons";
import { useColors } from "../../context/ThemeContext";
import { TimePicker } from "./TimePicker";
import type { TimePickerProps } from "./TimePicker";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TimeRangePickerProps {
  /** Start time as "HH:MM" 24h string */
  startTime: string;
  /** End time as "HH:MM" 24h string */
  endTime: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  /** Labels shown above each picker (defaults: "Start" / "End") */
  startLabel?: string;
  endLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Accent colour key from theme (defaults: "primary1") */
  color?: TimePickerProps["color"];
  startError?: string;
  endError?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function TimeRangePicker({
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  startLabel = "Start",
  endLabel = "End",
  disabled = false,
  style,
  color = "primary1",
  startError,
  endError,
}: TimeRangePickerProps) {
  const colors = useColors();
  const RightIcon = ICONS.right;

  return (
    <View style={[styles.container, style]}>
      {/* Start picker */}
      <View style={styles.pickerWrapper}>
        <TimePicker
          label={startLabel}
          value={startTime}
          onChange={onStartChange}
          disabled={disabled}
          color={color}
          error={startError}
        />
      </View>

      {/* Arrow between pickers */}
      <View style={styles.arrowWrapper}>
        <RightIcon size={ICON_SIZES.sm} color={(COLORS[color as keyof typeof COLORS] as string) ?? COLORS.primary1} />
      </View>

      {/* End picker */}
      <View style={styles.pickerWrapper}>
        <TimePicker
          label={endLabel}
          value={endTime}
          onChange={onEndChange}
          disabled={disabled}
          color={color}
          error={endError}
        />
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACING.xs,
  },
  pickerWrapper: {
    flex: 1,
  },
  arrowWrapper: {
    paddingBottom: moderateScale(10),
    alignItems: "center",
    justifyContent: "center",
  },
});

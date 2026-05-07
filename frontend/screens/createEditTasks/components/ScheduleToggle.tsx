/**
 * ScheduleToggle
 *
 * Reusable Auto / Manual schedule toggle with:
 *   - A segmented pill (Auto | Manual)
 *   - Manual mode: inline CalendarPicker + start / end time inputs
 *   - Auto mode: "⚡ Will be auto-scheduled" badge + optional current time
 *
 * Used by both SubtaskScheduleCard and SingleTaskScheduleSection to avoid
 * duplicating the same UI + styles.
 */

import React, { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { COLORS, SPACING, FONT_SIZES, SHADOWS, FONTS, getDynamicColors } from "../../../theme";
import { useTheme } from "../../../context/ThemeContext";
import AppText from "../../../components/common/AppText";
import Input from "../../../components/inputs/Input";
import CalendarPicker from "../../../components/inputs/CalendarPicker";
import { TimeRangePicker } from "../../../components/inputs/TimeRangePicker";
import { ICONS } from "../../../components/icons/icons";

export interface ScheduleToggleData {
  mode: "auto" | "manual";
  date?: string;
  startTime?: string;
  endTime?: string;
}

interface Props {
  /** Current schedule values */
  schedule: ScheduleToggleData;
  /** Called when any field changes */
  onChange: (field: keyof ScheduleToggleData, value: string) => void;
}

const ScheduleToggle: React.FC<Props> = ({ schedule, onChange }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const isManual = schedule.mode === "manual";
  let colors = getDynamicColors("light");
  try {
    const { colors: themeColors } = useTheme();
    colors = themeColors;
  } catch {
    // Fall back to light tokens when rendered outside the theme provider.
  }

  // Detect overnight: if both times are set and endTime ≤ startTime the session
  // crosses midnight (e.g. 21:00 → 05:00). We show a hint so the user knows.
  const isOvernight: boolean = (() => {
    if (!schedule.startTime || !schedule.endTime) return false;
    const [sh, sm] = schedule.startTime.split(":").map(Number);
    const [eh, em] = schedule.endTime.split(":").map(Number);
    return (eh * 60 + em) <= (sh * 60 + sm);
  })();

  return (
    <View style={styles.container}>
      <AppText variant="boldText" style={styles.label}>
        Schedule
      </AppText>

      {/* Auto / Manual toggle pill */}
      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => onChange("mode", "auto")}
          style={[styles.togglePill, !isManual && styles.togglePillActive]}
        >
          <AppText style={[styles.toggleText, !isManual && styles.toggleTextActive]}>Auto</AppText>
        </Pressable>
        <Pressable
          onPress={() => onChange("mode", "manual")}
          style={[styles.togglePill, isManual && styles.togglePillActive]}
        >
          <AppText style={[styles.toggleText, isManual && styles.toggleTextActive]}>Manual</AppText>
        </Pressable>
      </View>

      {isManual ? (
        <View style={styles.sessionFields}>
          {/* Date selector — same pattern as TaskDetailsSection */}
          <Input
            label="Date"
            placeholder="YYYY-MM-DD"
            value={schedule.date}
            type="text"
            editable={false}
            onPress={() => setShowCalendar((v) => !v)}
            rightElement={
              ICONS.calendar ? React.createElement(ICONS.calendar, { size: 24, color: COLORS.primary1 }) : null
            }
          />

          {showCalendar && (
            <View style={[styles.inlineCalendar, { backgroundColor: colors.bg3 }]}>
              <CalendarPicker
                selectedDate={schedule.date}
                onDateSelect={(d: string) => {
                  onChange("date", d);
                  setShowCalendar(false);
                }}
              />
            </View>
          )}

          {/* Start + End time */}
          <TimeRangePicker
            startTime={schedule.startTime ?? ""}
            endTime={schedule.endTime ?? ""}
            onStartChange={(v) => onChange("startTime", v)}
            onEndChange={(v) => onChange("endTime", v)}
            color="primary1"
          />

          {/* Overnight hint — shown automatically when endTime ≤ startTime */}
          {isOvernight && (
            <View style={styles.overnightBadge}>
              <AppText style={styles.overnightText}>
                🌙 Overnight — ends the next day
              </AppText>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.autoBadge}>
          {schedule.date && (
            <AppText variant="notes" style={styles.autoCurrentTime}>
              Current: {schedule.date} {schedule.startTime}-{schedule.endTime}
            </AppText>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
  },
  label: {
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  toggleRow: {
    flexDirection: "row",
    borderRadius: SPACING.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.primary1,
    marginBottom: SPACING.md,
  },
  togglePill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  togglePillActive: {
    backgroundColor: COLORS.primary1,
  },
  toggleText: {
    fontFamily: FONTS.fredokaMedium,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary1,
  },
  toggleTextActive: {
    color: COLORS.colorWhite,
  },
  sessionFields: {
    gap: SPACING.sm,
  },
  inlineCalendar: {
    borderRadius: 12,
    marginBottom: SPACING.sm,
    overflow: "hidden",
    ...SHADOWS.card,
  },
  autoBadge: {
    backgroundColor: COLORS.white3,
    borderRadius: SPACING.sm,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  autoText: {
    color: COLORS.darkGray,
  },
  autoCurrentTime: {
    color: COLORS.lightGray,
    fontSize: FONT_SIZES.sm,
  },
  overnightBadge: {
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary7,
    marginTop: SPACING.xs,
  },
  overnightText: {
    color: COLORS.primary7,
    fontSize: FONT_SIZES.sm,
    fontFamily: FONTS.fredokaMedium,
  },
});

export default ScheduleToggle;

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
import { COLORS, SPACING, FONT_SIZES, SHADOWS, FONTS } from "../../../theme";
import AppText from "../../../components/common/AppText";
import Input from "../../../components/inputs/Input";
import CalendarPicker from "../../../components/inputs/CalendarPicker";
import { ICONS } from "../../../components/icons/icons";

export interface ScheduleToggleData {
  mode: "auto" | "manual";
  date: string;
  startTime: string;
  endTime: string;
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
            <View style={styles.inlineCalendar}>
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
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Input
                label="Start (HH:MM)"
                placeholder="09:00"
                value={schedule.startTime}
                onChangeText={(v) => onChange("startTime", v)}
                type="text"
              />
            </View>
            <View style={styles.timeField}>
              <Input
                label="End (HH:MM)"
                placeholder="10:00"
                value={schedule.endTime}
                onChangeText={(v) => onChange("endTime", v)}
                type="text"
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.autoBadge}>
          {schedule.date && (
            <AppText variant="notes" style={styles.autoCurrentTime}>
              Current: {schedule.date} {schedule.startTime}–{schedule.endTime}
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
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    overflow: "hidden",
    ...SHADOWS.card,
  },
  timeRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  timeField: {
    flex: 1,
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
});

export default ScheduleToggle;

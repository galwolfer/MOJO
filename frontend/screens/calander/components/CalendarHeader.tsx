/**
 * CalendarHeader Component
 *
 * Header section for the calendar screen with title, calendar icon,
 * and date selector or calendar picker.
 *
 * Usage:
 * ```tsx
 * <CalendarHeader
 *   selectedDate={selectedDate}
 *   setSelectedDate={setSelectedDate}
 *   showCalendarPicker={showCalendarPicker}
 *   setShowCalendarPicker={setShowCalendarPicker}
 * />
 * ```
 */
import React from "react";
import { View, StyleSheet, TouchableOpacity, Platform, StatusBar } from "react-native";
import AppText from "../../../components/common/AppText";
import { COLORS, SPACING, FONT_SIZES, FONTS, SHADOWS, ICON_SIZES } from "../../../theme";
import { ICONS } from "../../../components/icons/icons";
import DateSelector from "../../../components/layout/DateSelector";
import CalendarPicker from "../../../components/inputs/CalendarPicker";
import { getLocalDateString } from "../../../utils/dateUtils";

interface CalendarHeaderProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  showCalendarPicker: boolean;
  setShowCalendarPicker: (show: boolean) => void;
}

export default function CalendarHeader({
  selectedDate,
  setSelectedDate,
  showCalendarPicker,
  setShowCalendarPicker,
}: CalendarHeaderProps) {
  return (
    <View style={styles.headerWrapper}>
      <View style={styles.headerOuterShadow}>
        <View style={styles.headerInnerClip}>
          <View style={styles.headerCard}>
            <View style={styles.headerTitleRow}>
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() => setShowCalendarPicker(!showCalendarPicker)}
                activeOpacity={0.7}
              >
                <ICONS.calendar size={ICON_SIZES.md} color={COLORS.primary1} />
              </TouchableOpacity>
              <AppText style={styles.headerTitle}>MY TASKS</AppText>
            </View>

            {showCalendarPicker ? (
              <CalendarPicker
                onDateSelect={(dateString) => {
                  const date = new Date(dateString);
                  setSelectedDate(date);
                }}
                selectedDate={getLocalDateString(selectedDate)}
                allowPastDates={true}
                allowPreviousMonths={true}
                lighterPastDates={true}
              />
            ) : (
              <DateSelector selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: COLORS.white3,
    overflow: "visible",
  },
  headerOuterShadow: {
    backgroundColor: COLORS.colorWhite,
    borderBottomLeftRadius: SPACING.xlg,
    borderBottomRightRadius: SPACING.xlg,
    position: "relative",
    zIndex: 50,
    overflow: "visible",
    ...(SHADOWS.card as object),
  },
  headerInnerClip: {
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: "hidden",
  },
  headerCard: {
    backgroundColor: COLORS.colorWhite,
    width: "100%",
    borderBottomLeftRadius: SPACING.xlg,
    borderBottomRightRadius: SPACING.xlg,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + SPACING.xs : SPACING.xlg + SPACING.lg,
    paddingHorizontal: SPACING.sm,
    paddingBottom: 0,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontFamily: FONTS.fredokaBold,
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary1,
    paddingTop: 0,
  },
  headerIcon: {
    marginTop: 0,
    marginRight: SPACING.sm,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
});

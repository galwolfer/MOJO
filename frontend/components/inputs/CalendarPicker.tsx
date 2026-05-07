/**
 * Calendar Picker Component
 *
 * A reusable calendar date picker with month navigation.
 * Displays a traditional calendar grid with clickable dates.
 */

import React, { useState, useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import AppText from "../common/AppText";
import { COLORS, SPACING, FONT_SIZES, SHADOWS, FONTS, ICON_SIZES, getDynamicColors } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { ICONS } from "../icons/icons";

interface CalendarPickerProps {
  onDateSelect: (date: string) => void;
  selectedDate?: string;
  allowPastDates?: boolean;
  allowPreviousMonths?: boolean;
  lighterPastDates?: boolean;
}

interface DayCell {
  date: number;
  isCurrentMonth: boolean;
  dateString: string;
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({
  onDateSelect,
  selectedDate,
  allowPastDates = false,
  allowPreviousMonths = false,
  lighterPastDates = false,
}) => {
  let colors = getDynamicColors("light");
  let resolvedTheme: "light" | "dark" = "light";
  try {
    const { colors: themeColors, resolvedTheme: themeMode } = useTheme();
    colors = themeColors;
    resolvedTheme = themeMode;
  } catch {
    // Fall back to light tokens when rendered outside the theme provider.
  }

  const [currentDate, setCurrentDate] = useState(new Date());

  const monthName = currentDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getCalendarDays = (): DayCell[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Days from previous month to fill the grid
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: DayCell[] = [];
    let day = new Date(startDate);

    // Generate 6 weeks worth of days (42 days)
    const leadingDays = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const totalNeeded = leadingDays + daysInMonth;

    const weeks = Math.ceil(totalNeeded / 7);
    const cellsCount = weeks * 7;

    for (let i = 0; i < cellsCount; i++) {
      const isCurrentMonth = day.getMonth() === month;
      const year = day.getFullYear();
      const month_ = String(day.getMonth() + 1).padStart(2, "0");
      const date = String(day.getDate()).padStart(2, "0");
      const dateString = `${year}-${month_}-${date}`;

      days.push({
        date: day.getDate(),
        isCurrentMonth,
        dateString,
      });

      day = new Date(day);
      day.setDate(day.getDate() + 1);
    }

    return days;
  };

  const calendarDays = useMemo(() => getCalendarDays(), [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleDatePress = (dateString: string) => {
    const selectedDateObject = new Date(dateString);
    if (Number.isNaN(selectedDateObject.getTime())) {
      return;
    }

    if (!selectedDateObject || selectedDateObject.getMonth() !== currentDate.getMonth() || selectedDateObject.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(new Date(selectedDateObject.getFullYear(), selectedDateObject.getMonth(), 1));
    }

    onDateSelect(dateString);
  };

  const isDateSelected = (dateString: string) => {
    return selectedDate === dateString;
  };

  const isDateInPast = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isToday = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = () => {
    const today = new Date();
    return currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
  };

  const isPrevMonthDisabled = !allowPreviousMonths && isCurrentMonth();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg3 }]}>
      {/* Header with Month/Year and Navigation */}
      <View style={styles.header}>
        <Pressable
          style={[styles.navButton, { backgroundColor: colors.primary1 }, isPrevMonthDisabled && styles.navButtonDisabled]}
          onPress={handlePrevMonth}
          disabled={isPrevMonthDisabled}
        >
          {ICONS.left &&
            React.createElement(ICONS.left, {
              size: ICON_SIZES.sm,
              color: isPrevMonthDisabled ? colors.gray1 : colors.text2,
            })}
        </Pressable>

        <AppText style={[styles.monthYear, { color: colors.primary1 }]}>{monthName}</AppText>

        <Pressable style={[styles.navButton, { backgroundColor: colors.primary1 }]} onPress={handleNextMonth}>
          {ICONS.right &&
            React.createElement(ICONS.right, {
              size: ICON_SIZES.sm,
              color: colors.text2,
            })}
        </Pressable>
      </View>

      {/* Day Labels */}
      <View style={styles.dayLabelsContainer}>
        {dayLabels.map((label) => (
          <View key={label} style={styles.dayLabelCell}>
            <AppText style={[styles.dayLabel, { color: colors.gray2 }]}>{label}</AppText>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((day, index) => {
          const isPast = isDateInPast(day.dateString);
          const isOutsideMonth = !day.isCurrentMonth;
          const isDisabled = !isOutsideMonth && isPast && !allowPastDates;
          const weeksCount = Math.ceil(calendarDays.length / 7);
          const lastRowStartIndex = (weeksCount - 1) * 7;
          const isLastRow = index >= lastRowStartIndex;
          const outsideMonthColor = resolvedTheme === "dark" ? colors.gray1 : colors.gray1;
          const pastInMonthColor = lighterPastDates
            ? resolvedTheme === "dark"
              ? colors.gray2
              : colors.gray2
            : colors.text1;

          return (
            <Pressable
              key={index}
              style={[
                styles.dateCell,
                isOutsideMonth && styles.dateCellInactive,
                isDateSelected(day.dateString) && styles.dateCellSelected,
              ]}
              onPress={() => !isDisabled && handleDatePress(day.dateString)}
              disabled={isDisabled}
            >
              <AppText
                style={[
                  styles.dateText,
                  {
                    color: isOutsideMonth ? outsideMonthColor : isPast ? pastInMonthColor : colors.text1,
                  },
                  !isLastRow && { marginBottom: SPACING.md },
                  isOutsideMonth && styles.dateTextInactive,
                  isPast && styles.dateTextPast,
                  isDateSelected(day.dateString) && styles.dateTextSelected,
                ]}
              >
                {day.date}
              </AppText>
              {isToday(day.dateString) && (
                <View
                  style={[
                    styles.todayDot,
                    { backgroundColor: colors.primary1 },
                    isDateSelected(day.dateString) && styles.todayDotSelected,
                  ]}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  navButton: {
    width: SPACING.xlg,
    height: SPACING.xlg,
    borderRadius: SPACING.lg,
    backgroundColor: COLORS.primary1,
    justifyContent: "center",
    alignItems: "center",
    ...(SHADOWS.card as object),
  },
  navButtonDisabled: {
    opacity: 0.6,
  },
  monthYear: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
    color: COLORS.primary1,
    textAlign: "center",
    flex: 1,
    fontFamily: FONTS.fredokaSemiBold,
  },
  dayLabelsContainer: {
    flexDirection: "row",
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  dayLabelCell: {
    width: "14.285%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SPACING.xs,
  },
  dayLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: "500",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dateCell: {
    width: "14.285%", // 7 columns (100/7)
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: SPACING.md,
    marginBottom: SPACING.sm,
  },
  dateCellInactive: {
    opacity: 1,
  },
  dateCellPast: {
    opacity: 0.4,
  },
  dateCellPastLighter: {
    opacity: 0.9,
  },
  dateCellSelected: {
    backgroundColor: COLORS.primary1,
    ...(SHADOWS.card as object),
  },
  dateText: {
    fontSize: FONT_SIZES.md,
    fontWeight: "500",
  },
  dateTextInactive: {
    fontWeight: "400",
  },
  dateTextPast: {
    textDecorationLine: "line-through",
  },
  dateTextPastLighter: {
    color: COLORS.lightGray,
  },
  dateTextSelected: {
    color: COLORS.white,
    fontFamily: FONTS.fredokaSemiBold,
    fontWeight: "500",
  },
  todayDot: {
    width: ICON_SIZES.sm,
    height: SPACING.xs,
    borderRadius: SPACING.xs,
  },
  todayDotSelected: {
    backgroundColor: COLORS.white,
  },
});

export default CalendarPicker;

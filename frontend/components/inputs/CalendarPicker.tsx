/**
 * Calendar Picker Component
 * 
 * A reusable calendar date picker with month navigation.
 * Displays a traditional calendar grid with clickable dates.
 */

import React, { useState, useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import AppText from "../common/AppText";
import { COLORS, SPACING, FONT_SIZES, SHADOWS, FONTS } from "../../theme";
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

const CalendarPicker: React.FC<CalendarPickerProps> = ({ onDateSelect, selectedDate, allowPastDates = false, allowPreviousMonths = false, lighterPastDates = false }) => {
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
    const leadingDays = firstDay.getDay();      // כמה ימים ריקים לפני ה-1 בחודש
    const daysInMonth = lastDay.getDate();      // כמה ימים יש בחודש
    const totalNeeded = leadingDays + daysInMonth;

    const weeks = Math.ceil(totalNeeded / 7);   // כמה שורות לוח צריך (4/5/6)
    const cellsCount = weeks * 7;               // כמה תאים באמת נדרשים

    for (let i = 0; i < cellsCount; i++) {
      const isCurrentMonth = day.getMonth() === month;
      const year = day.getFullYear();
      const month_ = String(day.getMonth() + 1).padStart(2, '0');
      const date = String(day.getDate()).padStart(2, '0');
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
    return currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear();
  };

  return (
    <View style={styles.container}>
      {/* Header with Month/Year and Navigation */}
      <View style={styles.header}>
        <Pressable 
          style={[styles.navButton, !allowPreviousMonths && isCurrentMonth() && styles.navButtonDisabled]} 
          onPress={handlePrevMonth}
          disabled={!allowPreviousMonths && isCurrentMonth()}
        >
          {ICONS.left &&
            React.createElement(ICONS.left, {
              size: 24,
              color: !allowPreviousMonths && isCurrentMonth() ? "#B8B3CC" : COLORS.white,
            })}
        </Pressable>

        <AppText style={styles.monthYear}>{monthName}</AppText>

        <Pressable style={styles.navButton} onPress={handleNextMonth}>
          {ICONS.right &&
            React.createElement(ICONS.right, {
              size: 24,
              color: COLORS.white,
            })}
        </Pressable>
      </View>

      {/* Day Labels */}
      <View style={styles.dayLabelsContainer}>
        {dayLabels.map((label) => (
          <View key={label} style={styles.dayLabelCell}>
            <AppText style={styles.dayLabel}>{label}</AppText>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((day, index) => {
          const isPast = isDateInPast(day.dateString);
          const isDisabled = !day.isCurrentMonth || (isPast && !allowPastDates);
          const weeksCount = Math.ceil(calendarDays.length / 7);
          const lastRowStartIndex = (weeksCount - 1) * 7;
          const isLastRow = index >= lastRowStartIndex;
          return (
            <Pressable
              key={index}
              style={[
                styles.dateCell,
                !day.isCurrentMonth && styles.dateCellInactive,
                isPast && (lighterPastDates ? styles.dateCellPastLighter : styles.dateCellPast),
                isDateSelected(day.dateString) && styles.dateCellSelected,
              ]}
              onPress={() => !isDisabled && handleDatePress(day.dateString)}
              disabled={isDisabled}
            >
              <AppText
                style={[
                  styles.dateText,
                  !isLastRow && { marginBottom: 10 },
                  !day.isCurrentMonth && styles.dateTextInactive,
                  isPast && (lighterPastDates ? styles.dateTextPastLighter : styles.dateTextPast),
                  isDateSelected(day.dateString) && styles.dateTextSelected,
                ]}
              >
                {day.date}
              </AppText>
              {isToday(day.dateString) && (
                <View style={[styles.todayDot, isDateSelected(day.dateString) && styles.todayDotSelected]} />
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
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary1,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.card,
  },
  navButtonDisabled: {
    backgroundColor: "#C8C3D8",
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
    marginBottom: SPACING.sm,
    paddingHorizontal: 4,
  },
  dayLabelCell: {
    width: "14.285%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 4,
  },
  dayLabel: {
    fontSize: 13,
    color: "#9B95B5", // Muted purple-gray
    fontWeight: "500",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    // paddingHorizontal: 4,
  },
  dateCell: {
    width: "14.285%", // 7 columns (100/7)
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    marginBottom: 5,
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
    ...SHADOWS.card,
  },
  dateText: {
    fontSize: FONT_SIZES.md,
    color: "#2D2D2D", // Dark gray for current month dates
    fontWeight: "500",
  },
  dateTextInactive: {
    color: "#B8B3CC", // Light purple-gray for adjacent month dates
    fontWeight: "400",
  },
  dateTextPast: {
    color: "#D0CBDF", // Very light purple-gray for past dates
    textDecorationLine: "line-through",
  },
  dateTextPastLighter: {
    color: "#D0CBDF",
  },
  dateTextSelected: {
    color: COLORS.white,
    fontFamily: FONTS.fredokaSemiBold,
    fontWeight: "500",
  },
  todayDot: {
    width: 18,
    height: 3,
    borderRadius: 0,
    backgroundColor: COLORS.primary1,
  },
  todayDotSelected: {
    backgroundColor: COLORS.white,
  },
});

export default CalendarPicker;

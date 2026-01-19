/**
 * Calendar Picker Component
 * 
 * A reusable calendar date picker with month navigation.
 * Displays a traditional calendar grid with clickable dates.
 */

import React, { useState, useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import AppText from "../common/AppText";
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from "../../theme";
import { ICONS } from "../icons/icons";

interface CalendarPickerProps {
  onDateSelect: (date: string) => void;
  selectedDate?: string;
}

interface DayCell {
  date: number;
  isCurrentMonth: boolean;
  dateString: string;
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({ onDateSelect, selectedDate }) => {
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
    for (let i = 0; i < 42; i++) {
      const isCurrentMonth = day.getMonth() === month;
      const dateString = day.toISOString().split("T")[0]; // YYYY-MM-DD format

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
          style={[styles.navButton, isCurrentMonth() && styles.navButtonDisabled]} 
          onPress={handlePrevMonth}
          disabled={isCurrentMonth()}
        >
          {ICONS.left &&
            React.createElement(ICONS.left, {
              size: 24,
              color: isCurrentMonth() ? "#B8B3CC" : COLORS.white,
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
          const isDisabled = !day.isCurrentMonth || isPast;
          
          return (
            <Pressable
              key={index}
              style={[
                styles.dateCell,
                !day.isCurrentMonth && styles.dateCellInactive,
                isPast && styles.dateCellPast,
                isDateSelected(day.dateString) && styles.dateCellSelected,
              ]}
              onPress={() => !isDisabled && handleDatePress(day.dateString)}
              disabled={isDisabled}
            >
              <AppText
                style={[
                  styles.dateText,
                  !day.isCurrentMonth && styles.dateTextInactive,
                  isPast && styles.dateTextPast,
                  isDateSelected(day.dateString) && styles.dateTextSelected,
                ]}
              >
                {day.date}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.md,
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
    paddingHorizontal: 4,
  },
  dateCell: {
    width: "14.285%", // 7 columns (100/7)
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    marginBottom: 16,
  },
  dateCellInactive: {
    opacity: 1,
  },
  dateCellPast: {
    opacity: 0.4,
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
  dateTextSelected: {
    color: COLORS.white,
    fontWeight: "500",
  },
});

export default CalendarPicker;

import React from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import AppText from "../common/AppText";
import { COLORS, SPACING, FONT_SIZES, FONTS } from "../../theme";
import { ICONS } from "../icons/icons";

/**
 * DateSelector Component
 *
 * A horizontal date selector for navigating between dates.
 * Displays 5 days with navigation buttons on each side.
 * Features:
 * - Selected date highlighted with a pill-shaped background
 * - Today indicator with a small dot
 * - Previous/Next day navigation buttons
 *
 * Props:
 * - selectedDate: The currently selected date
 * - setSelectedDate: Function to update the selected date
 */

interface DateSelectorProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}

export default function DateSelector({ selectedDate, setSelectedDate }: DateSelectorProps) {
  const daysScrollRef = React.useRef<ScrollView>(null);

  const stripTime = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const getDaysArray = () => {
    const days = [];
    const now = new Date();
    const startDate = new Date(selectedDate);
    startDate.setDate(startDate.getDate() - 2);

    for (let i = 0; i < 5; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      days.push({
        date: date.getDate(),
        dayName: date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3),
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isToday: date.toDateString() === now.toDateString(),
        fullDate: date,
      });
    }

    return days;
  };

  const handlePrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const days = getDaysArray();

  React.useEffect(() => {
    const currentDays = getDaysArray();
    const selectedIndex = currentDays.findIndex((d) => d.isSelected);
    if (selectedIndex < 0) return;

    daysScrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [selectedDate]);

  return (
    <View style={styles.headerDaySelector}>
      <TouchableOpacity onPress={handlePrevDay} style={[styles.navButton, styles.navCircle]}>
        <ICONS.left size={18} color={COLORS.colorWhite} />
      </TouchableOpacity>

      <View style={styles.daysRow}>
        {days.map((day, idx) => {
          const isToday = day.isToday;
          const isSelected = day.isSelected;

          const showPill = isSelected;
          const showDot = isToday;
          const dotWhite = isToday && isSelected;

          return (
            <TouchableOpacity
              key={idx}
              style={[styles.dayItem, showPill && styles.dayItemSelected]}
              onPress={() => setSelectedDate(day.fullDate)}
              activeOpacity={0.85}
            >
              <AppText style={[styles.dayName, showPill && styles.dayTextOnPill]}>
                {day.dayName}
              </AppText>

              <AppText style={[styles.dayDate, showPill && styles.dayTextOnPill]}>
                {day.date}
              </AppText>

              {showDot && <View style={[styles.todayDot, dotWhite && styles.todayDotOnPill]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity onPress={handleNextDay} style={[styles.navButton, styles.navCircle]}>
        <ICONS.right size={18} color={COLORS.colorWhite} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  headerDaySelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "transparent",
    borderRadius: 20,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
    alignSelf: "stretch",
  },
  navButton: {
    padding: SPACING.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  navCircle: {
    backgroundColor: COLORS.primary1,
    borderRadius: 20,
    width: 40,
    height: 40,
  },
  daysRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
  },
  dayItem: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 72,
    borderRadius: 28,
    backgroundColor: "transparent",
  },
  dayItemSelected: {
    backgroundColor: COLORS.primary1,
    width: 70,
    height: 72,
    borderRadius: 28,
  },
  dayName: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary1,
    fontWeight: "400",
    marginBottom: 2,
  },
  dayDate: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.md,
    color: COLORS.black,
    fontWeight: "600",
  },
  dayTextOnPill: {
    color: COLORS.colorWhite,
    fontWeight: "600",
  },
  todayDot: {
    marginTop: 6,
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary1,
  },
  todayDotOnPill: {
    backgroundColor: COLORS.colorWhite,
  },
});

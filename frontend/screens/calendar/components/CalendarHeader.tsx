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
import { TouchableOpacity } from "react-native";
import Header from "../../../components/common/Header";
import { COLORS, ICON_SIZES } from "../../../theme";
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
  const calendarIcon = (
    <TouchableOpacity onPress={() => setShowCalendarPicker(!showCalendarPicker)} activeOpacity={0.7}>
      <ICONS.calendar size={ICON_SIZES.md} color={COLORS.primary1} />
    </TouchableOpacity>
  );

  const bottomElement = showCalendarPicker ? (
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
  );

  return <Header title="MY TASKS" leftElement={calendarIcon} element={bottomElement} />;
}

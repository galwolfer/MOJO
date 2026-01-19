/**
 * Calendar Event Widget
 * Displays a calendar event or schedule item
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "../common/AppText";
import AppButton from "../common/AppButton";
import { COLORS, SPACING } from "../../theme";
import Widget from "../special/Widget";
import { BaseWidgetProps } from "../../utils/widgetFactory";

interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  allDay?: boolean;
  color?: string;
  reminder?: string;
}

/**
 * CalendarEventWidget - Renders a calendar event
 */
const CalendarEventWidget: React.FC<BaseWidgetProps> = ({ data, onAction }) => {
  const event: CalendarEvent = data.event || data;

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return null;
    try {
      // Handle both "HH:mm" and ISO date strings
      if (timeStr.includes(":") && timeStr.length <= 5) {
        return timeStr;
      }
      const date = new Date(timeStr);
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return timeStr;
    }
  };

  const getEventColor = (colorName?: string) => {
    if (!colorName) return COLORS.primary1;
    switch (colorName.toLowerCase()) {
      case "green":
        return COLORS.primary6;
      case "red":
        return COLORS.primary7;
      case "orange":
        return COLORS.primary5;
      case "purple":
        return COLORS.primary3;
      case "blue":
      default:
        return COLORS.primary1;
    }
  };

  const handleAddToCalendar = () => {
    onAction?.("add_to_calendar", { event });
  };

  const handleDismiss = () => {
    onAction?.("dismiss", { eventId: event.id });
  };

  const eventColor = getEventColor(event.color);

  return (
    <Widget skipAnimation>
      <View style={styles.container}>
        {/* Color Bar */}
        <View style={[styles.colorBar, { backgroundColor: eventColor }]} />

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <AppText variant="title3" style={styles.title}>
              {event.title}
            </AppText>
            {event.allDay && (
              <View style={styles.allDayBadge}>
                <AppText variant="notes" style={styles.allDayText}>
                  All Day
                </AppText>
              </View>
            )}
          </View>

          {/* Date and Time */}
          <View style={styles.dateTimeSection}>
            <View style={styles.dateRow}>
              <AppText style={styles.emoji}>📅</AppText>
              <AppText variant="bodyText">{formatDate(event.startDate)}</AppText>
              {event.endDate && event.endDate !== event.startDate && (
                <>
                  <AppText variant="bodyText" style={styles.arrowText}>
                    {" → "}
                  </AppText>
                  <AppText variant="bodyText">{formatDate(event.endDate)}</AppText>
                </>
              )}
            </View>

            {!event.allDay && (event.startTime || event.endTime) && (
              <View style={styles.timeRow}>
                <AppText style={styles.emoji}>🕐</AppText>
                <AppText variant="bodyText">
                  {formatTime(event.startTime) || "Start"}
                  {event.endTime && ` - ${formatTime(event.endTime)}`}
                </AppText>
              </View>
            )}
          </View>

          {/* Description */}
          {event.description && (
            <AppText variant="notes" numberOfLines={3} style={styles.description}>
              {event.description}
            </AppText>
          )}

          {/* Location */}
          {event.location && (
            <View style={styles.locationRow}>
              <AppText style={styles.emoji}>📍</AppText>
              <AppText variant="notes" style={styles.metaText}>
                {event.location}
              </AppText>
            </View>
          )}

          {/* Reminder */}
          {event.reminder && (
            <View style={styles.reminderRow}>
              <AppText style={styles.emoji}>🔔</AppText>
              <AppText variant="notes" style={styles.metaText}>
                Reminder: {event.reminder}
              </AppText>
            </View>
          )}

          {/* Action buttons removed for now */}
        </View>
      </View>
    </Widget>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    overflow: "hidden",
  },
  colorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: SPACING.md,
  },
  content: {
    flex: 1,
    gap: SPACING.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  title: {
    flex: 1,
    fontWeight: "600",
  },
  allDayBadge: {
    backgroundColor: COLORS.primary1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  allDayText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.colorWhite,
  },
  dateTimeSection: {
    gap: 4,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  emoji: {
    fontSize: 14,
    marginRight: 4,
  },
  arrowText: {
    color: COLORS.darkGray,
  },
  description: {
    lineHeight: 18,
    paddingVertical: 4,
    color: COLORS.darkGray,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    color: COLORS.darkGray,
  },
  // actions & button styles removed while buttons are disabled
});

export default CalendarEventWidget;

/**
 * EmptyState Component
 *
 * Displays an empty state when no tasks exist for the selected date.
 * Features:
 * - Animated rotating Mojo logo
 * - Friendly message
 * - Call-to-action button to add a task
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   rotationValue={rotationValue}
 *   showCalendarPicker={showCalendarPicker}
 *   onAddTask={handleAddTask}
 * />
 * ```
 */
import React from "react";
import { View, StyleSheet, TouchableOpacity, Animated } from "react-native";
import AppText from "../../../components/common/AppText";
import { COLORS, SPACING, FONT_SIZES, SHADOWS, FONTS, TYPOGRAPHY, ICON_SIZES } from "../../../theme";
import { ICONS } from "../../../components/icons/icons";

interface EmptyStateProps {
  rotationValue: Animated.Value;
  showCalendarPicker: boolean;
  onAddTask: () => void;
}

export default function EmptyState({ rotationValue, showCalendarPicker, onAddTask }: EmptyStateProps) {
  const rotation = rotationValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={[styles.emptyStateContainer, showCalendarPicker && styles.emptyStateContainerWithCalendar]}>
      <View style={styles.emptyStateContent}>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          {ICONS.bestojo &&
            React.createElement(ICONS.bestojo, {
              size: ICON_SIZES.big * 3.5,
              color: COLORS.primary1,
            })}
        </Animated.View>

        <AppText style={styles.emptyStateTitle}>No Tasks Today</AppText>

        <AppText style={styles.emptyStateDescription}>You have cleared your schedule!</AppText>

        <AppText style={styles.emptyStateSubtext}>Want to add a new task or goal for this day?</AppText>

        <TouchableOpacity style={styles.emptyStateButton} activeOpacity={0.8} onPress={onAddTask}>
          <AppText style={styles.emptyStateButtonText}>+ Add Task</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
  },
  emptyStateContainerWithCalendar: {
    marginTop: -80,
  },
  emptyStateContent: {
    alignItems: "center",
    gap: SPACING.lg,
  },
  emptyStateTitle: {
    ...TYPOGRAPHY.title2,
    textAlign: "center",
  },
  emptyStateDescription: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.darkGray,
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  emptyStateButton: {
    backgroundColor: COLORS.primary6,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: SPACING.md,
    marginTop: SPACING.md,
    ...(SHADOWS.card as object),
  },
  emptyStateButtonText: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.base,
    color: COLORS.white,
    textAlign: "center",
  },
});

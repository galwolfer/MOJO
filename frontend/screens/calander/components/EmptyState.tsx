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

 *   showCalendarPicker={showCalendarPicker}
 *   onAddTask={handleAddTask}
 * />
 * ```
 */
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import AppText from "../../../components/common/AppText";
import { COLORS, SPACING, FONT_SIZES, FONTS, TYPOGRAPHY, ICON_SIZES } from "../../../theme";
import AppButton from "../../../components/common/AppButton";
import { ICONS } from "../../../components/icons/icons";

interface EmptyStateProps {
  showCalendarPicker: boolean;
  onAddTask: () => void;
}

export default function EmptyState({ showCalendarPicker, onAddTask }: EmptyStateProps) {
  const rotationValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;
    const startRotation = () => {
      if (!isMounted) return;
      rotationValue.setValue(0);
      Animated.timing(rotationValue, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && isMounted) startRotation();
      });
    };
    startRotation();
    return () => {
      isMounted = false;
      rotationValue.stopAnimation();
    };
  }, []);

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

        <AppButton title="+ Add Task" onPress={onAddTask} color="primary6" mode="filled" style={{ alignSelf: "center" }} />
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

});

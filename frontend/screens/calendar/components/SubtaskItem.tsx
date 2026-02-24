/**
 * SubtaskItem Component
 *
 * Displays a single subtask with checkbox, title, optional time range, and delete button.
 *
 * Usage:
 * ```tsx
 * <SubtaskItem
 *   subtask={subtask}
 *   parentTaskId={taskId}
 *   isCompleted={completedSubtasks.has(subtask.id)}
 *   onToggle={handleSubtaskToggle}
 *   onDelete={handleSubtaskDelete}
 * />
 * ```
 */
import React, { useCallback } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../../../components/common/AppText";
import { COLORS, SPACING, FONT_SIZES, FONTS, ICON_SIZES } from "../../../theme";
import { Checkbox } from "../../../components/icons/Checkbox.native";
import { ICONS } from "../../../components/icons/icons";
import { Subtask } from "../types";

interface SubtaskItemProps {
  subtask: Subtask;
  parentTaskId: string;
  isCompleted: boolean;
  categoryColor?: string;
  showTime?: boolean;
  onToggle: (parentTaskId: string, subtaskId: string, checked: boolean) => void;
  onDelete?: (parentTaskId: string, subtaskId: string) => void;
}

export default function SubtaskItem({
  subtask,
  parentTaskId,
  isCompleted,
  categoryColor,
  showTime = true,
  onToggle,
}: SubtaskItemProps) {
  const handlePress = useCallback(() => {
    onToggle(parentTaskId, subtask.id, !isCompleted);
  }, [onToggle, parentTaskId, subtask.id, isCompleted]);

  return (
    <TouchableOpacity style={styles.subtaskContainer} onPress={handlePress} activeOpacity={0.6}>
      <View style={styles.subtaskRow}>
        {/* Checkbox is visual-only; the outer TouchableOpacity handles the toggle */}
        <View pointerEvents="none">
          <Checkbox checked={isCompleted} onChange={() => {}} size={ICON_SIZES.sm} />
        </View>
        <View style={styles.subtaskContent}>
          <AppText variant="notes" style={[styles.subtaskText, isCompleted && styles.subtaskTextCompleted]}>
            {subtask.title}
          </AppText>
          {showTime && subtask.timeRange && (
            <View style={styles.timeRangeRow}>
              <AppText style={[styles.subtaskTimeRange, isCompleted && styles.subtaskTimeRangeCompleted]}>
                {subtask.timeRange}
              </AppText>
              <ICONS.clock
                size={ICON_SIZES.xs}
                color={isCompleted ? COLORS.lightGray : (categoryColor ?? COLORS.darkGray)}
              />
            </View>
          )}
        </View>
      </View>
      {subtask.description && (
        <AppText style={[styles.subtaskDescription, isCompleted && styles.subtaskDescriptionCompleted]}>
          {subtask.description}
        </AppText>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  subtaskContainer: {
    gap: SPACING.xs,
    width: "100%",
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    width: "100%",
  },
  subtaskContent: {
    flex: 1,
    gap: 2,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  subtaskText: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
  },
  timeRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  subtaskTimeRange: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
  },
  subtaskTimeRangeCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  subtaskDescription: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    marginLeft: SPACING.xlg,
    lineHeight: Math.round(FONT_SIZES.sm * 1.2),
  },
  subtaskTextCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  subtaskDescriptionCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
});

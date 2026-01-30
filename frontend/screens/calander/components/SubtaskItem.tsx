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
import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../../../components/common/AppText";
import { COLORS, SPACING, FONT_SIZES, FONTS, ICON_SIZES } from "../../../theme";
import { ICONS } from "../../../components/icons/icons";
import { Checkbox } from "../../../components/icons/Checkbox.native";
import { Subtask } from "../types";

interface SubtaskItemProps {
  subtask: Subtask;
  parentTaskId: string;
  isCompleted: boolean;
  onToggle: (parentTaskId: string, subtaskId: string, checked: boolean) => void;
  onDelete: (parentTaskId: string, subtaskId: string) => void;
}

export default function SubtaskItem({ subtask, parentTaskId, isCompleted, onToggle, onDelete }: SubtaskItemProps) {
  return (
    <View style={styles.subtaskContainer}>
      <View style={styles.subtaskRow}>
        <Checkbox
          checked={isCompleted}
          onChange={(checked) => {
            console.log("[SubtaskItem] Checkbox clicked:", {
              parentTaskId,
              subtaskId: subtask.id,
              subtaskTitle: subtask.title,
              checked,
            });
            onToggle(parentTaskId, subtask.id, checked);
          }}
          size={ICON_SIZES.sm}
        />
        <View style={{ flex: 1 }}>
          <AppText variant="notes" style={[styles.subtaskText, isCompleted && styles.subtaskTextCompleted]}>
            {subtask.title}
          </AppText>
          {subtask.timeRange && (
            <AppText style={[styles.subtaskTimeRange, isCompleted && styles.subtaskTimeRangeCompleted]}>
              {subtask.timeRange}
            </AppText>
          )}
        </View>
        <TouchableOpacity onPress={() => onDelete(parentTaskId, subtask.id)} style={styles.subtaskDeleteButton}>
          <ICONS.trash size={ICON_SIZES.sm} color={COLORS.lightGray} />
        </TouchableOpacity>
      </View>
      {subtask.description && (
        <AppText style={[styles.subtaskDescription, isCompleted && styles.subtaskDescriptionCompleted]}>
          {subtask.description}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  subtaskContainer: {
    gap: SPACING.xs,
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  subtaskText: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
  },
  subtaskTimeRange: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    marginTop: SPACING.xs,
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
  subtaskDeleteButton: {
    padding: SPACING.xs,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: SPACING.sm,
  },
});

/**
 * TaskListItem
 *
 * Compact list row for the All Tasks view.
 * Shows: category icon, subcategory icon (if available), task name.
 * Tapping the row opens the task detail modal.
 */
import React, { memo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../../../components/common/AppText";
import Icon from "../../../components/icons/Icon";
import { ProgressIcon } from "../../../components/icons/ProgressIcon.native";
import { getCategoryMeta } from "../../../config/categoryMeta";
import { COLORS, SPACING, FONTS, FONT_SIZES, ICON_SIZES } from "../../../theme";
import { TaskWithSubtasks } from "../../../services/taskService";

interface TaskListItemProps {
  task: TaskWithSubtasks;
  onPress: (task: TaskWithSubtasks) => void;
}

function TaskListItem({ task, onPress }: TaskListItemProps) {
  const categoryMeta = getCategoryMeta(task.category);
  const subCat = task.subCategory;
  const subIcon = subCat?.icon;
  const progress =
    typeof task.progressPercentage === "number" ? Math.max(0, Math.min(1, task.progressPercentage / 100)) : 0;

  const isDone = task.status === "done" || task.completed;

  return (
    <TouchableOpacity
      style={[styles.container, isDone && styles.containerDone]}
      onPress={() => onPress(task)}
      activeOpacity={0.7}
    >
      {/* Category icon */}
      <View style={[styles.iconBadge, { backgroundColor: categoryMeta.color + "18" }]}>
        <Icon name={categoryMeta.icon as string} size={ICON_SIZES.sm} color={categoryMeta.color} />
      </View>

      {/* Subcategory icon (if available and different from category icon) */}
      {subIcon && subIcon !== categoryMeta.icon ? (
        <View style={styles.subIconWrap}>
          <Icon name={subIcon} size={ICON_SIZES.xs} color={COLORS.lightGray} />
        </View>
      ) : null}

      {/* Task name */}
      <AppText variant="bodyText" numberOfLines={1} style={[styles.taskName, isDone && styles.taskNameDone]}>
        {task.taskname || (task as any).title || "Untitled"}
      </AppText>

      {/* Progress indicator */}
      <ProgressIcon value={progress} size={ICON_SIZES.sm} />
    </TouchableOpacity>
  );
}

export default memo(TaskListItem);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
  },
  containerDone: {
    opacity: 0.6,
  },
  iconBadge: {
    width: ICON_SIZES.md + SPACING.sm * 2,
    height: ICON_SIZES.md + SPACING.sm * 2,
    borderRadius: (ICON_SIZES.md + SPACING.sm * 2) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  subIconWrap: {
    marginLeft: -SPACING.xs,
  },
  taskName: {
    flex: 1,
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
  },
  taskNameDone: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
});

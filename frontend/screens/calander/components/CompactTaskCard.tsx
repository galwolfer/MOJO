/**
 * CompactTaskCard Component
 *
 * Renders the compact (collapsed) view of a task card.
 * Displays time, title, category icon, progress indicator,
 * inline subtask checkboxes for multi-day tasks, and edit/delete actions.
 *
 * This is an internal sub-component used exclusively by TaskCard.
 */
import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../../../components/common/AppText";
import { COLORS, SPACING, FONT_SIZES, FONTS, ICON_SIZES } from "../../../theme";
import { ICONS } from "../../../components/icons/icons";
import { Checkbox } from "../../../components/icons/Checkbox.native";
import { ProgressIcon } from "../../../components/icons/ProgressIcon.native";
import { CategoryMeta } from "../../../config/categoryMeta";
import { Task } from "../types";

export interface CompactTaskCardProps {
  task: Task;
  isCompleted: boolean;
  completedSubtasks: Set<string>;
  effectiveId: string;
  categoryMeta: CategoryMeta | null;
  IconComponent: React.ComponentType<any> | null;
  taskProgress: number;
  onPress: (taskId: string) => void;
  onToggleCompletion: (taskId: string, checked: boolean) => void;
  onEdit: (task: Task) => void;
  onConfirmDelete: () => void;
  onSubtaskToggle: (taskId: string, subtaskId: string, checked: boolean) => void;
}

export default function CompactTaskCard({
  task,
  isCompleted,
  completedSubtasks,
  effectiveId,
  categoryMeta,
  IconComponent,
  taskProgress,
  onPress,
  onToggleCompletion,
  onEdit,
  onConfirmDelete,
  onSubtaskToggle,
}: CompactTaskCardProps) {
  return (
    <TouchableOpacity style={styles.taskCardCompact} onPress={() => onPress(task.id)} activeOpacity={0.7}>
      <View style={[styles.taskColorBarCompact, { backgroundColor: categoryMeta?.color || task.color }]} />

      <View style={styles.taskCompactLeft}>
        <AppText style={styles.taskTimeCompact}>{task.time}</AppText>
        {task.endTime && <AppText style={styles.taskTimeSeparatorCompact}>{task.endTime}</AppText>}
      </View>

      {/* Multi-day subtask layout vs simple layout */}
      {task.subtasks && task.subtasks.length > 0 && task.partNumber && task.totalParts && task.totalParts > 1 ? (
        <View style={styles.taskCompactMiddle}>
          <View style={styles.taskTitleRowCompact}>
            <Checkbox
              checked={isCompleted}
              onChange={(checked) => onToggleCompletion(effectiveId, checked)}
              size={ICON_SIZES.md}
            />
            {IconComponent &&
              categoryMeta &&
              React.createElement(IconComponent, {
                size: ICON_SIZES.sm,
                color: categoryMeta.color,
              })}
            <AppText style={styles.taskTitleCompact}>{task.title}</AppText>
          </View>

          {/* Inline subtask checkboxes for multi-day tasks */}
          <View style={styles.subtasksContainerCompact}>
            {task.subtasks.map((subtask) => (
              <View key={subtask.id} style={styles.subtaskRowCompact}>
                <Checkbox
                  checked={completedSubtasks.has(subtask.id)}
                  onChange={(checked) => {
                    const parentTaskId = task.taskId || task.id;
                    onSubtaskToggle(parentTaskId, subtask.id, checked);
                  }}
                  size={ICON_SIZES.sm}
                />
                <View style={{ flex: 1 }}>
                  <AppText
                    style={[
                      styles.subtaskTextCompact,
                      completedSubtasks.has(subtask.id) && styles.subtaskTextCompactCompleted,
                    ]}
                  >
                    {subtask.title}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.taskCompactMiddle}>
          <View style={styles.taskTitleRowCompact}>
            <Checkbox
              checked={isCompleted}
              onChange={(checked) => onToggleCompletion(effectiveId, checked)}
              size={20}
            />
            {IconComponent &&
              categoryMeta &&
              React.createElement(IconComponent, {
                size: ICON_SIZES.sm,
                color: categoryMeta.color,
              })}
            <AppText style={styles.taskTitleCompact}>{task.title}</AppText>
          </View>
        </View>
      )}

      <View style={styles.taskCompactRight}>
        {task.subtasks &&
          task.subtasks.length > 0 &&
          (taskProgress === 1 ? (
            <Checkbox checked={true} size={ICON_SIZES.md} onChange={() => {}} />
          ) : (
            <ProgressIcon value={taskProgress} size={ICON_SIZES.md} />
          ))}
        <TouchableOpacity onPress={() => onEdit(task)} style={styles.editButton}>
          {IconComponent && categoryMeta && (
            <View style={[styles.categoryIconContainerCompact, { backgroundColor: categoryMeta.color }]}>
              {React.createElement(IconComponent, {
                size: ICON_SIZES.sm,
                color: COLORS.colorWhite,
              })}
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={onConfirmDelete} style={styles.deleteButton}>
          <ICONS.trash size={ICON_SIZES.md} color={COLORS.lightGray} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  taskCardCompact: {
    flexDirection: "row",
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingLeft: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
    backgroundColor: COLORS.white3,
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  taskColorBarCompact: {
    width: SPACING.xs + 1,
    height: SPACING.xlg * 2,
    borderRadius: SPACING.xs,
  },
  taskCompactLeft: {
    justifyContent: "center",
    alignItems: "flex-start",
    minWidth: SPACING.xlg * 1.5,
  },
  taskTimeCompact: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    lineHeight: Math.round(FONT_SIZES.sm * 1.2),
  },
  taskTimeSeparatorCompact: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    lineHeight: 16,
    marginTop: SPACING.xlg,
  },
  taskCompactMiddle: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  taskTitleRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
    flexWrap: "nowrap",
    minWidth: 0,
  },
  taskTitleCompact: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
    lineHeight: 20,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  subtasksContainerCompact: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
    paddingLeft: SPACING.md,
  },
  subtaskRowCompact: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  subtaskTextCompact: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.black,
  },
  subtaskTextCompactCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  taskCompactRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  categoryIconContainerCompact: {
    width: 24,
    height: 24,
    borderRadius: SPACING.md,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  editButton: {
    padding: SPACING.xs,
  },
  deleteButton: {
    padding: SPACING.xs,
    justifyContent: "center",
    alignItems: "center",
  },
});

/**
 * ExpandedTaskCard Component
 *
 * Renders the expanded (detailed) view of a task card.
 * Displays the full-height color bar, time column, title with icon and checkbox,
 * part info, tags, progress icon, due date, description, and full subtask list.
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
import SubtaskItem from "./SubtaskItem";
import { TaskTitle } from "../../../components/special/task/TaskTitle";
import { TaskTagsRow } from "../../../components/special/task/TaskTagsRow";

export interface ExpandedTaskCardProps {
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
  onSubtaskDelete: (taskId: string, subtaskId: string) => void;
}

export default function ExpandedTaskCard({
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
  onSubtaskDelete,
}: ExpandedTaskCardProps) {
  return (
    <TouchableOpacity style={styles.taskExpandedContainer} onPress={() => onPress(task.id)} activeOpacity={0.9}>
      {/* Full-height color bar */}
      <View style={[styles.expandedColorBarFull, { backgroundColor: categoryMeta?.color || task.color }]} />

      {/* Top-right edit button */}
      <TouchableOpacity style={styles.expandedEditButtonTopRight} onPress={() => onEdit(task)}>
        <ICONS.edit size={ICON_SIZES.sm} color={COLORS.lightGray} />
      </TouchableOpacity>

      {/* Top-right delete button */}
      <TouchableOpacity style={styles.expandedDeleteButtonTopRight} onPress={onConfirmDelete}>
        <ICONS.trash size={ICON_SIZES.sm} color={COLORS.lightGray} />
      </TouchableOpacity>

      {/* Main layout */}
      <View style={styles.expandedMainRow}>
        {/* Left: Time */}
        <View style={styles.expandedLeftSection}>
          <AppText style={styles.expandedTime}>{task.time}</AppText>
          <View style={{ flex: 1 }} />
          {task.endTime && <AppText style={styles.expandedEndTime}>{task.endTime}</AppText>}
        </View>

        {/* Right: Content */}
        <View style={styles.expandedRightSection}>
          {/* Title Row */}
          <TaskTitle
            title={task.title}
            category={task.category}
            size="md"
            style={styles.expandedTitleRowInline}
            textStyle={styles.expandedTitleInline}
            iconStyle={{ marginLeft: 0, marginBottom: 0 }}
            leadingNode={
              <Checkbox
                checked={isCompleted}
                onChange={(checked) => onToggleCompletion(effectiveId, checked)}
                size={24}
              />
            }
          />

          {/* Part info for multi-day tasks */}
          {task.partNumber && task.totalParts && task.totalParts > 1 && task.subtasks?.length === 1 && (
            <AppText style={styles.expandedPartInfoText}>
              Part {task.partNumber}/{task.totalParts} for {task.parentTaskName}
            </AppText>
          )}

          {/* Tags and Progress */}
          <View style={styles.expandedProgressAndTagsRow}>
            <View style={{ flex: 1 }}>
              <TaskTagsRow
                category={task.category}
                importance={task.importance}
                effort={task.effort}
              />
            </View>
            {task.subtasks && task.subtasks.length > 0 && (
              <ProgressIcon value={taskProgress} size={ICON_SIZES.md} />
            )}
          </View>

          {/* Due Date */}
          {task.dueDate && !task.isScheduled && (
            <AppText style={styles.expandedDueDate}>{task.dueDate}</AppText>
          )}

          {/* Main Task Description */}
          {task.mainTaskDescription && (
            <AppText style={styles.expandedDescription}>{task.mainTaskDescription}</AppText>
          )}

          {/* Description */}
          {task.description && (!task.subtasks || task.subtasks.length === 0) && (
            <AppText style={styles.expandedDescription}>{task.description}</AppText>
          )}

          {/* Subtasks */}
          {task.subtasks && task.subtasks.length > 0 && (
            <View style={styles.expandedSubtasksContainer}>
              {task.subtasks.map((subtask) => (
                <SubtaskItem
                  key={subtask.id}
                  subtask={subtask}
                  parentTaskId={task.taskId || task.id}
                  isCompleted={completedSubtasks.has(subtask.id)}
                  onToggle={onSubtaskToggle}
                  onDelete={onSubtaskDelete}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  taskExpandedContainer: {
    backgroundColor: COLORS.colorWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingLeft: SPACING.md + SPACING.sm,
    position: "relative",
  },
  expandedColorBarFull: {
    position: "absolute",
    left: SPACING.sm,
    top: SPACING.md,
    bottom: SPACING.md,
    width: SPACING.xs + 1,
    borderRadius: SPACING.xs,
  },
  expandedEditButtonTopRight: {
    position: "absolute",
    top: SPACING.md,
    right: SPACING.md,
    padding: SPACING.xs,
    zIndex: 10,
  },
  expandedDeleteButtonTopRight: {
    position: "absolute",
    top: SPACING.md,
    right: SPACING.md + SPACING.xlg,
    padding: SPACING.xs,
    zIndex: 10,
  },
  expandedMainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  expandedLeftSection: {
    flexDirection: "column",
    alignItems: "center",
    gap: SPACING.xs,
    minWidth: SPACING.xlg + SPACING.md,
    justifyContent: "space-between",
  },
  expandedTime: {
    fontFamily: FONTS.fredokaBold,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
  },
  expandedEndTime: {
    fontFamily: FONTS.fredokaBold,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
  },
  expandedRightSection: {
    flex: 1,
    gap: SPACING.sm,
  },
  expandedTitleRowInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    flexWrap: "wrap",
  },
  expandedTitleInline: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
    lineHeight: Math.round(FONT_SIZES.base * 1.2),
    flex: 1,
    flexWrap: "wrap",
  },
  expandedProgressAndTagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  expandedTagsContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  expandedDueDate: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
  },
  expandedDescription: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    lineHeight: 18,
  },
  expandedPartInfoText: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    marginTop: 2,
  },
  expandedSubtasksContainer: {
    gap: SPACING.sm,
    paddingLeft: SPACING.md,
  },
});

/**
 * TaskCard Component
 *
 * Displays a task card with compact and expanded views.
 * Features:
 * - Compact view with time, title, category icon, and progress
 * - Expanded view with full details, tags, subtasks, and actions
 * - Toggle between compact and expanded by tapping
 * - Category color bar and icon
 * - Completion checkbox
 * - Edit and delete actions
 *
 * Usage:
 * ```tsx
 * <TaskCard
 *   task={task}
 *   isExpanded={expandedTaskId === task.id}
 *   isCompleted={completedTasks.has(task.id)}
 *   completedSubtasks={completedSubtasks}
 *   onPress={handleTaskPress}
 *   onToggleCompletion={handleTaskCompletionToggle}
 *   onEdit={handleEditTask}
 *   onDelete={handleDeleteTask}
 *   onSubtaskToggle={handleSubtaskCompletionToggle}
 *   onSubtaskDelete={handleDeleteSubtask}
 * />
 * ```
 */
import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../../../components/common/AppText";
import { COLORS, SPACING, FONT_SIZES, FONTS, ICON_SIZES } from "../../../theme";
import { ICONS } from "../../../components/icons/icons";
import { getCategoryMeta } from "../../../config/categoryMeta";
import { Checkbox } from "../../../components/icons/Checkbox.native";
import { ProgressIcon } from "../../../components/icons/ProgressIcon.native";
import { Task } from "../types";
import SubtaskItem from "./SubtaskItem";

interface TaskCardProps {
  task: Task;
  isExpanded: boolean;
  isCompleted: boolean;
  completedSubtasks: Set<string>;
  onPress: (taskId: string) => void;
  onToggleCompletion: (taskId: string, checked: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onSubtaskToggle: (taskId: string, subtaskId: string, checked: boolean) => void;
  onSubtaskDelete: (taskId: string, subtaskId: string) => void;
}

export default function TaskCard({
  task,
  isExpanded,
  isCompleted,
  completedSubtasks,
  onPress,
  onToggleCompletion,
  onEdit,
  onDelete,
  onSubtaskToggle,
  onSubtaskDelete,
}: TaskCardProps) {
  const categoryMeta = task.category ? getCategoryMeta(task.category) : null;
  const IconComponent = categoryMeta ? ICONS[categoryMeta.icon] : null;
  const effectiveId = (task as any).taskId || task.id;

  /**
   * Calculate progress for a task with subtasks
   */
  const getTaskProgress = (): number => {
    if (!task.subtasks || task.subtasks.length === 0) return 0;

    // Local optimistic progress
    const completedCount = task.subtasks.filter((s) => completedSubtasks.has(s.id)).length;
    const localProgress = completedCount / task.subtasks.length;

    // Server-provided progress
    const serverProgress =
      (task as any).progressPercentage !== undefined ? (task as any).progressPercentage / 100 : undefined;

    // Prefer server value when available
    if (typeof serverProgress === "number") {
      return serverProgress;
    }

    return localProgress;
  };

  // Expanded view
  if (isExpanded) {
    return (
      <TouchableOpacity style={styles.taskExpandedContainer} onPress={() => onPress(task.id)} activeOpacity={0.9}>
        {/* Full-height color bar */}
        <View style={[styles.expandedColorBarFull, { backgroundColor: categoryMeta?.color || task.color }]} />

        {/* Top-right edit button */}
        <TouchableOpacity style={styles.expandedEditButtonTopRight} onPress={() => onEdit(task)}>
          <ICONS.edit size={ICON_SIZES.sm} color={COLORS.lightGray} />
        </TouchableOpacity>

        {/* Top-right delete button */}
        <TouchableOpacity style={styles.expandedDeleteButtonTopRight} onPress={() => onDelete(effectiveId)}>
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
            <View style={styles.expandedTitleRowInline}>
              <Checkbox
                checked={isCompleted}
                onChange={(checked) => onToggleCompletion(effectiveId, checked)}
                size={24}
              />
              {IconComponent &&
                categoryMeta &&
                React.createElement(IconComponent, {
                  size: ICON_SIZES.md,
                  color: categoryMeta.color,
                })}
              <AppText style={styles.expandedTitleInline}>{task.title}</AppText>
            </View>

            {/* Part info for multi-day tasks */}
            {task.partNumber && task.totalParts && task.totalParts > 1 && task.subtasks?.length === 1 && (
              <AppText style={styles.expandedPartInfoText}>
                Part {task.partNumber}/{task.totalParts} for {task.parentTaskName}
              </AppText>
            )}

            {/* Tags and Progress */}
            <View style={styles.expandedProgressAndTagsRow}>
              {task.tags.length > 0 && (
                <View style={styles.expandedTagsContainer}>
                  {task.tags.map((tag, idx) => (
                    <View key={idx} style={styles.expandedTag}>
                      {IconComponent &&
                        React.createElement(IconComponent, {
                          size: ICON_SIZES.sm,
                          color: COLORS.darkP4,
                        })}
                      <AppText style={styles.expandedTagText}>{tag}</AppText>
                    </View>
                  ))}
                </View>
              )}
              {task.subtasks && task.subtasks.length > 0 && (
                <ProgressIcon value={getTaskProgress()} size={ICON_SIZES.md} />
              )}
            </View>

            {/* Due Date */}
            {task.dueDate && !(task as any).isScheduled && (
              <AppText style={styles.expandedDueDate}>{task.dueDate}</AppText>
            )}

            {/* Main Task Description */}
            {(task as any).mainTaskDescription && (
              <AppText style={styles.expandedDescription}>{(task as any).mainTaskDescription}</AppText>
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
                    parentTaskId={(task as any).taskId || task.id}
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

  // Compact view
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

          {/* Subtasks */}
          <View style={styles.subtasksContainerCompact}>
            {task.subtasks.map((subtask) => (
              <View key={subtask.id} style={styles.subtaskRowCompact}>
                <Checkbox
                  checked={completedSubtasks.has(subtask.id)}
                  onChange={(checked) => {
                    const parentTaskId = (task as any).taskId || task.id;
                    console.log("[compact subtask] Checkbox clicked:", {
                      parentTaskId,
                      subtaskId: subtask.id,
                      subtaskTitle: subtask.title,
                      isScheduled: (task as any).isScheduled,
                      checked,
                    });
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
          (getTaskProgress() === 1 ? (
            <Checkbox checked={true} size={ICON_SIZES.md} onChange={() => {}} />
          ) : (
            <ProgressIcon value={getTaskProgress()} size={ICON_SIZES.md} />
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
        <TouchableOpacity onPress={() => onDelete(effectiveId)} style={styles.deleteButton}>
          <ICONS.trash size={ICON_SIZES.md} color={COLORS.lightGray} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Compact styles
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
    gap: SPACING.sm,
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

  // Expanded styles
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
    right: SPACING.md + SPACING.lg,
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
  expandedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: COLORS.brightP4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: SPACING.sm,
  },
  expandedTagText: {
    fontFamily: FONTS.fredokaRegular,
    color: COLORS.darkP4,
    fontSize: FONT_SIZES.sm,
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

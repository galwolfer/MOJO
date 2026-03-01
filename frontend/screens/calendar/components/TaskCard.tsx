/**
 * TaskCard
 *
 * Single component. Compact row by default; expands to a detailed view when
 * `isExpanded` is true. All checkbox state is local so toggling one card
 * never re-renders its siblings.
 */
import React, { memo, useCallback, useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import PopupBox from "../../../components/common/PopupBox";
import { COLORS, SPACING, FONT_SIZES, FONTS, ICON_SIZES } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import { ICONS } from "../../../components/icons/icons";
import { ProgressIcon } from "../../../components/icons/ProgressIcon.native";
import { getCategoryMeta } from "../../../config/categoryMeta";
import { computeTaskProgress } from "../../../components/widgets/taskHelpers";
import { TaskTitle } from "../../../components/special/task/TaskTitle";
import { TaskTagsRow } from "../../../components/special/task/TaskTagsRow";
import { TwoColumnGrid, renderTaskField } from "../../../components/special/task";
import { SessionTime } from "../../../components/special/task/SessionTime";
import SubtaskItem from "./SubtaskItem";
import List from "../../../components/layout/List";
import { Task } from "../types";

interface TaskCardProps {
  task: Task;
  isExpanded: boolean;
  isCompleted: boolean;
  completedSubtasks: Set<string>;
  onPress: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onSubtaskToggle: (taskId: string, subtaskId: string, checked: boolean) => void;
  onSubtaskDelete: (taskId: string, subtaskId: string) => void;
}

function TaskCard({
  task,
  isExpanded,
  isCompleted: isCompletedProp,
  completedSubtasks: completedSubtasksProp,
  onPress,
  onEdit,
  onDelete,
  onSubtaskToggle,
  onSubtaskDelete,
}: TaskCardProps) {
  const colors = useColors();
  const categoryMeta = task.category ? getCategoryMeta(task.category) : null;
  const effectiveId = task.taskId || task.id;
  const categoryColor = categoryMeta?.color || task.color;

  // Local checkbox state — isolated so toggling never re-renders siblings.
  const [isCompleted, setIsCompleted] = useState(isCompletedProp);
  const [localSubtasks, setLocalSubtasks] = useState(completedSubtasksProp);

  useEffect(() => {
    setIsCompleted(isCompletedProp);
  }, [isCompletedProp]);

  // Compare Set contents so a silent refresh doesn't cause checkbox flicker.
  useEffect(() => {
    setLocalSubtasks((prev) => {
      if (prev === completedSubtasksProp) return prev;
      if (prev.size !== completedSubtasksProp.size) return completedSubtasksProp;
      for (const id of completedSubtasksProp) {
        if (!prev.has(id)) return completedSubtasksProp;
      }
      return prev;
    });
  }, [completedSubtasksProp]);

  const taskProgress =
    typeof task.progressPercentage === "number"
      ? Math.max(0, Math.min(1, task.progressPercentage / 100))
      : computeTaskProgress(task, localSubtasks) / 100;

  const [deleteVisible, setDeleteVisible] = useState(false);

  const handleSubtaskToggle = useCallback(
    (parentId: string, subtaskId: string, checked: boolean) => {
      setLocalSubtasks((prev) => {
        const next = new Set(prev);
        if (checked) next.add(subtaskId);
        else next.delete(subtaskId);
        return next;
      });
      onSubtaskToggle(parentId, subtaskId, checked);
    },
    [onSubtaskToggle],
  );

  const handleConfirmDelete = useCallback(() => setDeleteVisible(true), []);
  const handleCancelDelete = useCallback(() => setDeleteVisible(false), []);
  const handleDelete = useCallback(() => {
    setDeleteVisible(false);
    onDelete(effectiveId);
  }, [onDelete, effectiveId]);

  const isMultiDay =
    !!task.subtasks && task.subtasks.length > 0 && !!task.partNumber && !!task.totalParts && task.totalParts > 1;

  return (
    <>
      <TouchableOpacity
        style={[styles.container, { borderBottomColor: colors.bg2 }]}
        onPress={() => onPress(task.id)}
        activeOpacity={isExpanded ? 0.9 : 0.7}
      >
        {isExpanded && (
          <>
            <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(task)}>
              <ICONS.edit size={ICON_SIZES.sm} color={colors.gray1} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleConfirmDelete}>
              <ICONS.trash size={ICON_SIZES.sm} color={colors.gray1} />
            </TouchableOpacity>
          </>
        )}

        <View style={styles.row}>
          <SessionTime startLabel={task.time} endLabel={task.endTime} categoryColor={categoryColor} />

          <View style={styles.right}>
            <TaskTitle
              title={task.title}
              category={task.category}
              hideIcon={isExpanded}
              size={isExpanded ? "md" : "sm"}
              style={[
                styles.titleRow,
                isExpanded ? styles.titleRowExpanded : undefined,
                { marginBottom: isExpanded ? SPACING.sm : 0 },
              ]}
              textStyle={[
                styles.titleText,
                { fontFamily: isExpanded ? FONTS.fredokaSemiBold : FONTS.fredokaRegular, color: colors.text1 },
              ]}
              iconStyle={{ marginLeft: 0, marginBottom: 0 }}
              leadingNode={<ProgressIcon value={taskProgress} size={ICON_SIZES.md} />}
              reversed={!isExpanded}
            />

            {isExpanded && (
              <>
                <View style={styles.tagsProgressRow}>
                  <View style={{ flex: 1 }}>
                    <TaskTagsRow
                      category={task.category}
                      subcategoryDisplay={task.subcategoryDisplay}
                      subCategory={task.subCategory}
                      importance={task.importance}
                      effort={task.effort}
                      tags={task.tags}
                    />
                  </View>
                </View>

                <TwoColumnGrid
                  items={[
                    renderTaskField({ dueDate: task.deadline }, "dueDate"),
                    renderTaskField(task, "earliestStart"),
                    renderTaskField({ estimatedDuration: task.estimatedDuration }, "estimatedDuration"),
                  ]}
                />

                {task.mainTaskDescription && (
                  <AppText style={[styles.description, { color: colors.gray2 }]}>{task.mainTaskDescription}</AppText>
                )}
                {task.description && (
                  <AppText style={[styles.description, { color: colors.gray2 }]}>{task.description}</AppText>
                )}

                {task.subtasks && task.subtasks.length > 0 && (
                  <List
                    data={task.subtasks.map((subtask) => ({
                      id: subtask.id,
                      content: (
                        <SubtaskItem
                          subtask={subtask}
                          parentTaskId={effectiveId}
                          isCompleted={localSubtasks.has(subtask.id)}
                          categoryColor={categoryColor}
                          showTime={(task.subtasks?.length ?? 0) > 1}
                          onToggle={handleSubtaskToggle}
                          onDelete={onSubtaskDelete}
                        />
                      ),
                    }))}
                    gap={SPACING.sm}
                    style={{ marginTop: SPACING.sm, paddingLeft: SPACING.md }}
                  />
                )}
              </>
            )}

            {!isExpanded && isMultiDay && (
              <List
                data={task.subtasks!.map((subtask) => ({
                  id: subtask.id,
                  content: (
                    <SubtaskItem
                      subtask={subtask}
                      parentTaskId={effectiveId}
                      isCompleted={localSubtasks.has(subtask.id)}
                      categoryColor={categoryColor}
                      showTime={(task.subtasks?.length ?? 0) > 1}
                      onToggle={handleSubtaskToggle}
                    />
                  ),
                }))}
                gap={SPACING.sm}
                style={{ marginTop: SPACING.sm, paddingLeft: SPACING.md }}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    </>
  );
}

export default memo(TaskCard);

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    position: "relative",
  },
  row: {
    flexDirection: "row",
    flex: 1,
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  right: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
    flexWrap: "nowrap",
    minWidth: 0,
  },
  titleText: {
    fontSize: FONT_SIZES.base,
    flex: 1,
    minWidth: 0,
  },
  titleRowExpanded: {
    // Reserve space so title text doesn't bleed under the absolute-positioned edit/delete buttons
    paddingRight: SPACING.xlg * 2 + SPACING.md,
  },
  editBtn: {
    position: "absolute",
    top: SPACING.md,
    right: SPACING.md,
    padding: SPACING.xs,
    zIndex: 10,
  },
  deleteBtn: {
    position: "absolute",
    top: SPACING.md,
    right: SPACING.md + SPACING.xlg,
    padding: SPACING.xs,
    zIndex: 10,
  },
  tagsProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  partInfo: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    marginTop: 2,
  },
  dueDate: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
  },
  description: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    lineHeight: 18,
  },
  subtaskList: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
    paddingLeft: SPACING.md,
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  subtaskText: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    flex: 1,
  },
  completedText: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  popupMessage: {
    color: COLORS.darkGray,
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  popupActions: {
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "flex-end",
  },
  popupBtn: {
    minWidth: 90,
  },
});

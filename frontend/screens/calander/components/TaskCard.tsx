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
import { ICONS } from "../../../components/icons/icons";
import { Checkbox } from "../../../components/icons/Checkbox.native";
import { ProgressIcon } from "../../../components/icons/ProgressIcon.native";
import { getCategoryMeta } from "../../../config/categoryMeta";
import { computeTaskProgress } from "../../../components/widgets/taskHelpers";
import { TaskTitle } from "../../../components/special/task/TaskTitle";
import { TaskTagsRow } from "../../../components/special/task/TaskTagsRow";
import { SessionTime } from "../../../components/special/task/SessionTime";
import SubtaskItem from "./SubtaskItem";
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
        style={styles.container}
        onPress={() => onPress(task.id)}
        activeOpacity={isExpanded ? 0.9 : 0.7}
      >
        {isExpanded && (
          <>
            <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(task)}>
              <ICONS.edit size={ICON_SIZES.sm} color={COLORS.lightGray} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleConfirmDelete}>
              <ICONS.trash size={ICON_SIZES.sm} color={COLORS.lightGray} />
            </TouchableOpacity>
          </>
        )}

        <View style={styles.row}>
          <SessionTime startLabel={task.time} endLabel={task.endTime} categoryColor={categoryColor} />

          <View style={styles.right}>
            <TaskTitle
              title={task.title}
              category={task.category}
              size={isExpanded ? "md" : "sm"}
              style={[styles.titleRow, { marginBottom: isExpanded ? SPACING.sm : 0 }]}
              textStyle={[styles.titleText, { fontFamily: isExpanded ? FONTS.fredokaSemiBold : FONTS.fredokaRegular }]}
              iconStyle={{ marginLeft: 0, marginBottom: 0 }}
              leadingNode={<ProgressIcon value={taskProgress} size={ICON_SIZES.md} />}
            />

            {isExpanded && (
              <>
                <View style={styles.tagsProgressRow}>
                  <View style={{ flex: 1 }}>
                    <TaskTagsRow
                      category={task.category}
                      importance={task.importance}
                      effort={task.effort}
                      tags={task.tags}
                    />
                  </View>
                </View>

                {task.dueDate && !task.isScheduled && <AppText style={styles.dueDate}>{task.dueDate}</AppText>}
                {task.mainTaskDescription && <AppText style={styles.description}>{task.mainTaskDescription}</AppText>}
                {task.description && (!task.subtasks || task.subtasks.length === 0) && (
                  <AppText style={styles.description}>{task.description}</AppText>
                )}

                {task.subtasks && task.subtasks.length > 0 && (
                  <View style={styles.subtaskList}>
                    {task.subtasks.map((subtask) => (
                      <SubtaskItem
                        key={subtask.id}
                        subtask={subtask}
                        parentTaskId={effectiveId}
                        isCompleted={localSubtasks.has(subtask.id)}
                        onToggle={handleSubtaskToggle}
                        onDelete={onSubtaskDelete}
                      />
                    ))}
                  </View>
                )}
              </>
            )}

            {!isExpanded && isMultiDay && (
              <View style={styles.subtaskList}>
                {task.subtasks!.map((subtask) => (
                  <View key={subtask.id} style={styles.subtaskRow}>
                    <Checkbox
                      checked={localSubtasks.has(subtask.id)}
                      onChange={(checked) => handleSubtaskToggle(effectiveId, subtask.id, checked)}
                      size={ICON_SIZES.sm}
                    />
                    <AppText style={[styles.subtaskText, localSubtasks.has(subtask.id) && styles.completedText]}>
                      {subtask.title}
                    </AppText>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      <PopupBox visible={deleteVisible} onClose={handleCancelDelete} title="Delete Task">
        <AppText variant="bodyText" style={styles.popupMessage}>
          Are you sure you want to delete this task? This cannot be undone.
        </AppText>
        <View style={styles.popupActions}>
          <AppButton
            title="Cancel"
            onPress={handleCancelDelete}
            mode="light"
            color="primary1"
            style={styles.popupBtn}
          />
          <AppButton title="Delete" onPress={handleDelete} mode="filled" color="primary1" style={styles.popupBtn} />
        </View>
      </PopupBox>
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
    color: COLORS.black,
    flex: 1,
    minWidth: 0,
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
    color: COLORS.black,
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

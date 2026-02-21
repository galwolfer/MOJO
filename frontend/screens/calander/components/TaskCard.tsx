/**
 * TaskCard Component
 *
 * Dispatcher that resolves shared derived values (categoryMeta, IconComponent,
 * effectiveId, taskProgress, confirmDelete) and delegates rendering to either
 * CompactTaskCard (collapsed) or ExpandedTaskCard (detailed) based on isExpanded.
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
import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { getCategoryMeta } from "../../../config/categoryMeta";
import { ICONS } from "../../../components/icons/icons";
import { computeTaskProgress } from "../../../components/widgets/taskHelpers";
import { Task } from "../types";
import CompactTaskCard from "./CompactTaskCard";
import ExpandedTaskCard from "./ExpandedTaskCard";
import PopupBox from "../../../components/common/PopupBox";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import { COLORS, SPACING } from "../../../theme";

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
  const [deleteVisible, setDeleteVisible] = useState(false);

  // Resolve shared derived values once; pass down to sub-components
  const categoryMeta = task.category ? getCategoryMeta(task.category) : null;
  const IconComponent = categoryMeta ? ICONS[categoryMeta.icon] : null;
  const effectiveId = task.taskId || task.id;

  // Compute progress: prefer the server's authoritative progressPercentage (computed from ALL
  // subtasks), because the calendar API returns only the subtasks scheduled for a given day's
  // session, which makes local re-computation give different results per date for multi-day tasks.
  // Fall back to local computation only when progressPercentage is absent.
  const taskProgress =
    typeof task.progressPercentage === "number"
      ? Math.max(0, Math.min(1, task.progressPercentage / 100))
      : computeTaskProgress(task, completedSubtasks) / 100;

  const sharedProps = {
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
    onConfirmDelete: () => setDeleteVisible(true),
    onSubtaskToggle,
  };

  return (
    <>
      {isExpanded
        ? <ExpandedTaskCard {...sharedProps} onSubtaskDelete={onSubtaskDelete} />
        : <CompactTaskCard {...sharedProps} />}

      <PopupBox
        visible={deleteVisible}
        onClose={() => setDeleteVisible(false)}
        title="Delete Task"
      >
        <AppText style={styles.message}>
          Are you sure you want to delete "{task.title}"? This will also remove all scheduled sessions.
        </AppText>
        <View style={styles.actions}>
          <AppButton
            title="Delete"
            mode="filled"
            color="primary1"
            onPress={() => { setDeleteVisible(false); onDelete(effectiveId); }}
            style={styles.actionBtn}
          />
          <AppButton
            title="Cancel"
            mode="light"
            color="primary1"
            onPress={() => setDeleteVisible(false)}
            style={styles.actionBtn}
          />
        </View>
      </PopupBox>
    </>
  );
}

const styles = StyleSheet.create({
  message: {
    color: COLORS.darkGray,
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "flex-end",
  },
  actionBtn: {
    minWidth: 90,
  },
});
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
import React from "react";
import { Alert } from "react-native";
import { getCategoryMeta } from "../../../config/categoryMeta";
import { ICONS } from "../../../components/icons/icons";
import { Task } from "../types";
import CompactTaskCard from "./CompactTaskCard";
import ExpandedTaskCard from "./ExpandedTaskCard";

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
  // Resolve shared derived values once; pass down to sub-components
  const categoryMeta = task.category ? getCategoryMeta(task.category) : null;
  const IconComponent = categoryMeta ? ICONS[categoryMeta.icon] : null;
  const effectiveId = task.taskId || task.id;

  // Compute progress: prefer server value, fall back to local optimistic count
  const taskProgress = (() => {
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    const completedCount = task.subtasks.filter((s) => completedSubtasks.has(s.id)).length;
    const localProgress = completedCount / task.subtasks.length;
    const serverProgress =
      task.progressPercentage !== undefined ? task.progressPercentage / 100 : undefined;
    return typeof serverProgress === "number" ? serverProgress : localProgress;
  })();

  const confirmDelete = () => {
    Alert.alert(
      "Delete Task",
      `Are you sure you want to delete "${task.title}"? This will also remove all scheduled sessions.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete(effectiveId) },
      ],
    );
  };

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
    onConfirmDelete: confirmDelete,
    onSubtaskToggle,
  };

  if (isExpanded) {
    return <ExpandedTaskCard {...sharedProps} onSubtaskDelete={onSubtaskDelete} />;
  }
  return <CompactTaskCard {...sharedProps} />;
}
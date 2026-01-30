/**
 * TaskGroup Component
 *
 * Displays a group of tasks for a specific date, wrapped in a styled container.
 *
 * Usage:
 * ```tsx
 * <TaskGroup
 *   group={taskGroup}
 *   expandedTaskId={expandedTaskId}
 *   completedTasks={completedTasks}
 *   completedSubtasks={completedSubtasks}
 *   onTaskPress={handleTaskPress}
 *   onTaskToggle={handleTaskCompletionToggle}
 *   onTaskEdit={handleEditTask}
 *   onTaskDelete={handleDeleteTask}
 *   onSubtaskToggle={handleSubtaskCompletionToggle}
 *   onSubtaskDelete={handleDeleteSubtask}
 * />
 * ```
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "../../../components/common/AppText";
import { COLORS, SPACING, FONT_SIZES, FONTS, SHADOWS } from "../../../theme";
import { TaskGroup as TaskGroupType, Task } from "../types";
import TaskCard from "./TaskCard";

interface TaskGroupProps {
  group: TaskGroupType;
  expandedTaskId: string | null;
  completedTasks: Set<string>;
  completedSubtasks: Set<string>;
  onTaskPress: (taskId: string) => void;
  onTaskToggle: (taskId: string, checked: boolean) => void;
  onTaskEdit: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
  onSubtaskToggle: (taskId: string, subtaskId: string, checked: boolean) => void;
  onSubtaskDelete: (taskId: string, subtaskId: string) => void;
}

export default function TaskGroup({
  group,
  expandedTaskId,
  completedTasks,
  completedSubtasks,
  onTaskPress,
  onTaskToggle,
  onTaskEdit,
  onTaskDelete,
  onSubtaskToggle,
  onSubtaskDelete,
}: TaskGroupProps) {
  return (
    <View style={styles.dayGroupContainer}>
      <View style={styles.tasksGroupWrapper}>
        <View style={styles.dateHeaderInWrapper}>
          <AppText style={styles.dateHeaderTextInWrapper}>{group.date}</AppText>
        </View>

        <View style={styles.tasksInner}>
          {group.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isExpanded={expandedTaskId === task.id}
              isCompleted={completedTasks.has((task as any).taskId || task.id)}
              completedSubtasks={completedSubtasks}
              onPress={onTaskPress}
              onToggleCompletion={onTaskToggle}
              onEdit={onTaskEdit}
              onDelete={onTaskDelete}
              onSubtaskToggle={onSubtaskToggle}
              onSubtaskDelete={onSubtaskDelete}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dayGroupContainer: {
    marginBottom: SPACING.md,
  },
  tasksGroupWrapper: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: SPACING.lg,
    overflow: "hidden",
    marginLeft: SPACING.sm,
    marginRight: SPACING.sm,
    ...(SHADOWS.card as object),
  },
  dateHeaderInWrapper: {
    backgroundColor: COLORS.primary1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderTopLeftRadius: SPACING.lg,
    borderTopRightRadius: SPACING.lg,
  },
  dateHeaderTextInWrapper: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.base,
    color: COLORS.colorWhite,
    textAlign: "center",
    letterSpacing: 0.4,
  },
  tasksInner: {
    padding: 0,
  },
});

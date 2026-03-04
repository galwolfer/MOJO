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
import React, { memo } from "react";
import { StyleSheet } from "react-native";
import Box from "../../../components/layout/Box";
import List from "../../../components/layout/List";
import { COLORS, SPACING } from "../../../theme";
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

function TaskGroup({
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
    <Box title={group.date} style={styles.boxContainer} innerPadding={false}>
      <List
        data={group.tasks.map((task) => ({
          id: task.id,
          divider: false,
          content: (
            <TaskCard
              task={task}
              isExpanded={expandedTaskId === task.id}
              isCompleted={completedTasks.has(task.taskId || task.id)}
              completedSubtasks={completedSubtasks}
              onPress={onTaskPress}
              onEdit={onTaskEdit}
              onDelete={onTaskDelete}
              onTaskToggle={onTaskToggle}
              onSubtaskToggle={onSubtaskToggle}
              onSubtaskDelete={onSubtaskDelete}
            />
          ),
        }))}
      />
    </Box>
  );
}

const styles = StyleSheet.create({
  boxContainer: {
    marginLeft: SPACING.sm,
    marginRight: SPACING.sm,
    marginBottom: SPACING.md,
  },
});

export default memo(TaskGroup);

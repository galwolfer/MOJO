/**
 * Task List Widget
 * Displays a list of tasks with checkboxes, due dates, and basic details
 */

import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import AppText from "../common/AppText";
import { COLORS, SPACING } from "../../theme";
import Widget from "../special/Widget";
import { BaseWidgetProps } from "../../utils/widgetFactory";
import { useTaskContext } from "../../context/TaskContext";
import { completeTask, toggleTaskCompletion } from "../../services/taskService";

interface Task {
  id: string;
  title: string;
  status?: string;
  dueDate?: string;
  importance?: number;
  effort?: number;
}

/**
 * TaskListWidget - Renders a list of tasks
 */
const TaskListWidget: React.FC<BaseWidgetProps> = ({ data, onAction }) => {
  const tasks: Task[] = data.tasks || [];
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());
  const { notifyTaskUpdate } = useTaskContext();

  const handleToggleTask = async (taskId: string) => {
    // Optimistically update UI
    const newChecked = new Set(checkedTasks);
    const wasChecked = newChecked.has(taskId);
    
    if (wasChecked) {
      newChecked.delete(taskId);
    } else {
      newChecked.add(taskId);
    }
    setCheckedTasks(newChecked);
    
    // Track loading state
    setLoadingTasks((prev) => new Set(prev).add(taskId));
    
    try {
      // Call API to toggle/complete the task
      if (!wasChecked) {
        // Completing the task
        console.log(`[TaskListWidget] Completing task with ID: ${taskId}`);
        const result = await completeTask(taskId);
        console.log(`[TaskListWidget] Complete result:`, result);
      } else {
        // Uncompleting - use toggle
        console.log(`[TaskListWidget] Toggling task with ID: ${taskId}`);
        await toggleTaskCompletion(taskId);
      }
      
      // Notify other components (like UserProfile) to refresh
      notifyTaskUpdate();
      
      // Also call the onAction callback for any additional handling
      onAction?.("task_toggled", { taskId, checked: !wasChecked });
    } catch (error) {
      console.warn("Failed to toggle task:", error);
      // Revert optimistic update on error
      const revertChecked = new Set(checkedTasks);
      if (wasChecked) {
        revertChecked.add(taskId);
      } else {
        revertChecked.delete(taskId);
      }
      setCheckedTasks(revertChecked);
    } finally {
      setLoadingTasks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const handleTaskPress = (taskId: string) => {
    onAction?.("task_selected", { taskId });
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getImportanceColor = (importance?: number) => {
    if (!importance) return COLORS.darkGray;
    if (importance <= 2) return COLORS.primary6;
    if (importance <= 3) return COLORS.primary5;
    return COLORS.primary7;
  };

  if (!tasks || tasks.length === 0) {
    return (
      <Widget skipAnimation>
        <AppText variant="notes" style={styles.emptyText}>
          No tasks found
        </AppText>
      </Widget>
    );
  }

  return (
    <Widget skipAnimation>
      <ScrollView style={styles.container} scrollEnabled={tasks.length > 3} nestedScrollEnabled={true}>
        {tasks.map((task, index) => (
          <TouchableOpacity
            key={task.id || index}
            style={styles.taskItem}
            onPress={() => handleTaskPress(task.id)}
            activeOpacity={0.7}
          >
            <TouchableOpacity style={styles.checkbox} onPress={() => handleToggleTask(task.id)} activeOpacity={0.6}>
              <View style={[styles.checkboxBox, checkedTasks.has(task.id) && styles.checkboxBoxChecked]}>
                {checkedTasks.has(task.id) && <AppText style={styles.checkmark}>✓</AppText>}
              </View>
            </TouchableOpacity>

            <View style={styles.taskContent}>
              <AppText
                variant="bodyText"
                numberOfLines={2}
                style={[styles.taskTitle, checkedTasks.has(task.id) && styles.taskTitleCompleted]}
              >
                {task.title}
              </AppText>

              <View style={styles.taskMeta}>
                {task.dueDate && (
                  <AppText variant="notes" style={styles.metaText}>
                    📅 {formatDate(task.dueDate)}
                  </AppText>
                )}
                {task.importance && (
                  <View style={[styles.importanceBadge, { backgroundColor: getImportanceColor(task.importance) }]}>
                    <AppText variant="notes" style={styles.importanceText}>
                      P{task.importance}
                    </AppText>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Widget>
  );
};

const styles = StyleSheet.create({
  container: {
    // expanded: no maxHeight so the widget can grow to fit content
  },
  emptyText: {
    color: COLORS.lightGray,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
    gap: SPACING.md,
  },
  checkbox: {
    paddingRight: SPACING.sm,
    paddingTop: 2,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.darkGray,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxBoxChecked: {
    backgroundColor: COLORS.primary6,
    borderColor: COLORS.primary6,
  },
  checkmark: {
    fontSize: 12,
    color: COLORS.colorWhite,
    fontWeight: "600",
  },
  taskContent: {
    flex: 1,
    gap: 4,
  },
  taskTitle: {
    fontWeight: "500",
  },
  taskTitleCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  taskMeta: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
  },
  metaText: {
    color: COLORS.darkGray,
  },
  importanceBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  importanceText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.colorWhite,
  },
});

export default TaskListWidget;

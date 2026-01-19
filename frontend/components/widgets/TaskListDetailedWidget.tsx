/**
 * Task List Detailed Widget
 * Displays a list of tasks with expanded details for each
 */

import React from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import AppText from "../common/AppText";
import { COLORS, SPACING } from "../../theme";
import Widget from "../special/Widget";
import { BaseWidgetProps } from "../../utils/widgetFactory";

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  status?: string;
  importance?: number;
  effort?: number;
  category?: string;
}

/**
 * TaskListDetailedWidget - Renders a list of tasks with expanded details
 */
const TaskListDetailedWidget: React.FC<BaseWidgetProps> = ({ data, onAction }) => {
  const tasks: Task[] = data.tasks || [];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return COLORS.primary6;
      case "in_progress":
      case "in progress":
        return COLORS.primary1;
      case "pending":
        return COLORS.primary5;
      default:
        return COLORS.darkGray;
    }
  };

  const getImportanceColor = (importance?: number) => {
    if (!importance) return COLORS.darkGray;
    if (importance <= 2) return COLORS.primary6;
    if (importance <= 3) return COLORS.primary5;
    return COLORS.primary7;
  };

  const handleTaskSelect = (taskId: string) => {
    onAction?.("task_selected", { taskId });
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
      <ScrollView style={styles.container} scrollEnabled={tasks.length > 2} nestedScrollEnabled={true}>
        {tasks.map((task, index) => (
          <TouchableOpacity
            key={task.id || index}
            style={styles.taskCard}
            onPress={() => handleTaskSelect(task.id)}
            activeOpacity={0.7}
          >
            {/* Task Header */}
            <View style={styles.taskHeader}>
              <View style={styles.titleRow}>
                <AppText variant="bodyText" style={styles.taskTitle}>
                  {task.title}
                </AppText>
                {task.status && <View style={[styles.statusDot, { backgroundColor: getStatusColor(task.status) }]} />}
              </View>
              {task.importance && (
                <View style={[styles.importanceBadge, { backgroundColor: getImportanceColor(task.importance) }]}>
                  <AppText variant="notes" style={styles.importanceText}>
                    P{task.importance}
                  </AppText>
                </View>
              )}
            </View>

            {/* Description */}
            {task.description && (
              <AppText variant="notes" numberOfLines={2} style={styles.description}>
                {task.description}
              </AppText>
            )}

            {/* Task Meta */}
            <View style={styles.taskMeta}>
              {task.dueDate && (
                <View style={styles.metaItem}>
                  <AppText variant="notes" style={styles.metaText}>
                    📅 {formatDate(task.dueDate)}
                  </AppText>
                </View>
              )}

              {task.category && (
                <View style={styles.metaItem}>
                  <AppText variant="notes" style={styles.metaText}>
                    📁 {task.category}
                  </AppText>
                </View>
              )}

              {task.effort && (
                <View style={styles.metaItem}>
                  <AppText variant="notes" style={styles.metaText}>
                    💪 {task.effort}/5
                  </AppText>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Widget>
  );
};

const styles = StyleSheet.create({
  container: {
    // expanded: allow full height to include all items
  },
  emptyText: {
    color: COLORS.lightGray,
  },
  taskCard: {
    backgroundColor: COLORS.white2,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  taskTitle: {
    flex: 1,
    fontWeight: "600",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  importanceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  importanceText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.colorWhite,
  },
  description: {
    lineHeight: 18,
    color: COLORS.darkGray,
  },
  taskMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    color: COLORS.darkGray,
  },
});

export default TaskListDetailedWidget;

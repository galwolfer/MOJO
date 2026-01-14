/**
 * Task Detail Widget
 * Displays detailed information about a single task
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "../common/AppText";
import AppButton from "../common/AppButton";
import { COLORS, SPACING } from "../../theme";
import Widget from "../special/Widget";
import { BaseWidgetProps } from "../../utils/widgetFactory";

interface TaskDetail {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  startDate?: string;
  status?: string;
  importance?: number;
  effort?: number;
  category?: string;
  subcategory?: string;
  notes?: string;
}

/**
 * TaskDetailWidget - Renders detailed view of a single task
 */
const TaskDetailWidget: React.FC<BaseWidgetProps> = ({ data, onAction }) => {
  const task: TaskDetail = data.task || data;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Not set";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusStyle = (status?: string) => {
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

  const getImportanceLabel = (importance?: number) => {
    if (!importance) return "Not set";
    const labels = ["", "Low", "Medium-Low", "Medium", "High", "Critical"];
    return labels[importance] || `Priority ${importance}`;
  };

  const handleEdit = () => {
    onAction?.("edit_task", { taskId: task.id });
  };

  const handleComplete = () => {
    onAction?.("complete_task", { taskId: task.id });
  };

  const statusColor = getStatusStyle(task.status);

  return (
    <Widget skipAnimation>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <AppText variant="title3" style={styles.title}>
            {task.title}
          </AppText>
          {task.status && (
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <AppText variant="notes" style={styles.statusText}>
                {task.status.replace("_", " ").toUpperCase()}
              </AppText>
            </View>
          )}
        </View>

        {/* Description */}
        {task.description && (
          <View style={styles.section}>
            <AppText variant="notes" style={styles.labelText}>
              Description
            </AppText>
            <AppText variant="bodyText" style={styles.description}>
              {task.description}
            </AppText>
          </View>
        )}

        {/* Details Grid */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <AppText variant="notes" style={styles.labelText}>
              📅 Due Date
            </AppText>
            <AppText variant="bodyText">{formatDate(task.dueDate)}</AppText>
          </View>

          {task.startDate && (
            <View style={styles.detailItem}>
              <AppText variant="notes" style={styles.labelText}>
                🗓️ Start Date
              </AppText>
              <AppText variant="bodyText">{formatDate(task.startDate)}</AppText>
            </View>
          )}

          <View style={styles.detailItem}>
            <AppText variant="notes" style={styles.labelText}>
              ⚡ Importance
            </AppText>
            <AppText variant="bodyText">{getImportanceLabel(task.importance)}</AppText>
          </View>

          {task.effort && (
            <View style={styles.detailItem}>
              <AppText variant="notes" style={styles.labelText}>
                💪 Effort
              </AppText>
              <AppText variant="bodyText">Level {task.effort}/5</AppText>
            </View>
          )}

          {task.category && (
            <View style={styles.detailItem}>
              <AppText variant="notes" style={styles.labelText}>
                📁 Category
              </AppText>
              <AppText variant="bodyText">{task.category}</AppText>
            </View>
          )}

          {task.subcategory && (
            <View style={styles.detailItem}>
              <AppText variant="notes" style={styles.labelText}>
                📂 Subcategory
              </AppText>
              <AppText variant="bodyText">{task.subcategory}</AppText>
            </View>
          )}
        </View>

        {/* Notes */}
        {task.notes && (
          <View style={styles.section}>
            <AppText variant="notes" style={styles.labelText}>
              📝 Notes
            </AppText>
            <AppText variant="bodyText" style={styles.notes}>
              {task.notes}
            </AppText>
          </View>
        )}

        {/* Action buttons removed for now */}
      </View>
    </Widget>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  title: {
    flex: 1,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.colorWhite,
  },
  section: {
    gap: 4,
  },
  labelText: {
    color: COLORS.darkGray,
  },
  description: {
    lineHeight: 20,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  detailItem: {
    width: "45%",
    gap: 2,
  },
  notes: {
    backgroundColor: COLORS.white2,
    padding: SPACING.sm,
    borderRadius: 4,
    lineHeight: 18,
  },
  // actions and actionButton styles removed while buttons are disabled
});

export default TaskDetailWidget;

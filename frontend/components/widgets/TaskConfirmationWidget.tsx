/**
 * Task Confirmation Widget
 * Displays task details for user confirmation before creating/updating
 */

import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import AppText from "../common/AppText";
import AppButton from "../common/AppButton";
import { COLORS, SPACING } from "../../theme";
import Widget from "../special/Widget";
import { BaseWidgetProps } from "../../utils/widgetFactory";

interface TaskData {
  title: string;
  description?: string;
  dueDate?: string;
  importance?: number;
  effort?: number;
  category?: string;
  subcategory?: string;
  status?: string;
  notes?: string;
}

/**
 * TaskConfirmationWidget - Renders task details for confirmation
 */
const TaskConfirmationWidget: React.FC<BaseWidgetProps> = ({ data, onAction }) => {
  const task: TaskData = data.task || data;

  const handleConfirm = () => {
    onAction?.("confirmed", { task });
  };

  const handleEdit = () => {
    onAction?.("edit", { task });
  };

  const handleCancel = () => {
    onAction?.("cancelled", {});
  };

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

  const getImportanceLabel = (importance?: number) => {
    if (!importance) return "Not set";
    const labels = ["", "Low", "Medium-Low", "Medium", "High", "Critical"];
    return labels[importance] || `Level ${importance}`;
  };

  const getEffortLabel = (effort?: number) => {
    if (!effort) return "Not set";
    const labels = ["", "Minimal", "Light", "Moderate", "Heavy", "Extensive"];
    return labels[effort] || `Level ${effort}`;
  };

  return (
    <Widget skipAnimation>
      <ScrollView style={styles.container} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <AppText variant="title3" style={styles.headerTitle}>
            Confirm Task Details
          </AppText>
        </View>

        {/* Title */}
        <View style={styles.field}>
          <AppText variant="notes" style={styles.labelText}>
            Title
          </AppText>
          <AppText variant="bodyText">{task.title}</AppText>
        </View>

        {/* Description */}
        {task.description && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              Description
            </AppText>
            <AppText variant="bodyText">{task.description}</AppText>
          </View>
        )}

        {/* Due Date */}
        <View style={styles.field}>
          <AppText variant="notes" style={styles.labelText}>
            📅 Due Date
          </AppText>
          <AppText variant="bodyText">{formatDate(task.dueDate)}</AppText>
        </View>

        {/* Category */}
        {(task.categoryDisplay || task.category) && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              📁 Category
            </AppText>
            <AppText variant="bodyText">{task.categoryDisplay || task.category}</AppText>
          </View>
        )}

        {/* Subcategory */}
        {(task.subcategoryDisplay || task.subcategory) && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              📂 Subcategory
            </AppText>
            <AppText variant="bodyText">{task.subcategoryDisplay || task.subcategory}</AppText>
          </View>
        )}

        {/* Estimated duration */}
        {task.estimatedDuration != null && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              ⏱️ Estimated duration
            </AppText>
            <AppText variant="bodyText">{Math.round((task.estimatedDuration || 0) / 60)} hours</AppText>
          </View>
        )}

        {/* Splitting */}
        {task.taskType === "in_parts" && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              🔀 Splitting
            </AppText>
            <AppText variant="bodyText">
              {task.chunkCount ? `${task.chunkCount} parts` : "Split into parts"}
              {task.minChunk ? ` • min chunk ${task.minChunk} minutes` : ""}
            </AppText>
          </View>
        )}

        {/* Importance & Effort Row */}
        <View style={styles.row}>
          <View style={styles.halfField}>
            <AppText variant="notes" style={styles.labelText}>
              ⚡ Importance
            </AppText>
            <AppText variant="bodyText">{getImportanceLabel(task.importance)}</AppText>
          </View>
          <View style={styles.halfField}>
            <AppText variant="notes" style={styles.labelText}>
              💪 Effort
            </AppText>
            <AppText variant="bodyText">{getEffortLabel(task.effort)}</AppText>
          </View>
        </View>

        {/* Notes */}
        {task.notes && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              📝 Notes
            </AppText>
            <AppText variant="bodyText" numberOfLines={3} style={styles.notesText}>
              {task.notes}
            </AppText>
          </View>
        )}

        {/* Action buttons removed for now */}
      </ScrollView>
    </Widget>
  );
};

const styles = StyleSheet.create({
  container: {
    // allow full height so all fields are visible
  },
  header: {
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
    paddingBottom: SPACING.sm,
  },
  headerTitle: {
    fontWeight: "600",
  },
  field: {
    marginBottom: SPACING.md,
    gap: 4,
  },
  labelText: {
    color: COLORS.darkGray,
  },
  row: {
    flexDirection: "row",
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  halfField: {
    flex: 1,
    gap: 4,
  },
  notesText: {
    fontStyle: "italic",
    marginTop: 4,
  },
  confirmMessage: {
    marginVertical: SPACING.md,
    alignItems: "center",
  },
  confirmText: {
    color: COLORS.darkGray,
  },
  // actions and button styles removed while buttons are disabled
});

export default TaskConfirmationWidget;

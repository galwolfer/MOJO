/**
 * Task Confirmation Widget
 * Displays task details for user confirmation before creating/updating
 */

import React, { useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import AppText from "../common/AppText";
import { COLORS, SPACING } from "../../theme";
import Widget from "../special/Widget";
import { BaseWidgetProps } from "../../utils/widgetFactory";
import {
  formatDate,
  formatDateTime,
  formatTimeRange,
  formatDuration,
  getSessionLabel,
  getTaskTypeLabel,
  getWidgetEntranceProps,
} from "./widgetHelpers";
import { TaskTitle, TaskTagsRow, ScheduledSessionsSection, renderTaskField, TwoColumnGrid } from "../special/task";
import { getCategoryMeta } from "../../config/categoryMeta";
import { getCategoryDisplay } from "./widgetHelpers";

interface TaskData {
  id: string;
  title: string;
  taskname?: string;
  description?: string;
  dueDate?: string;
  deadline?: string;
  importance?: number;
  effort?: number;
  estimatedDuration?: number;
  duration?: number;
  category?: string;
  categoryDisplay?: string;
  subcategory?: string;
  subcategoryDisplay?: string;
  subCategory?: {
    label?: string;
    source?: string;
    confidence?: number;
    updatedAt?: string;
  };
  status?: string;
  canSplit?: boolean;
  taskType?: string;
  minChunk?: number | null;
  chunkCount?: number | null;
  chunkMinutes?: number | null;
  minMinutes?: number | null;
  maxMinutes?: number | null;
  earliestStart?: string | null;
  progressPercentage?: number;
  priorityScore?: number;
  scheduledSessions?: ScheduledSession[];
  subtasks?: Subtask[];
  recurrence?: {
    type: string;
    interval?: number;
    endDate?: string;
    count?: number;
  };
  tags?: string[] | null;
}

interface ScheduledSession {
  id?: string;
  start?: string;
  end?: string;
  status?: string;
  subtaskIndex?: number;
  subtaskTitle?: string;
}

interface Subtask {
  id?: string;
  title: string;
  description?: string;
  status?: string;
  completed?: boolean;
  order?: number;
  duration?: number;
  minutes?: number;
}

/**
 * TaskConfirmationWidget - Renders task details for confirmation
 * Note: data comes directly from the widget, no nested 'task' object
 */
const TaskConfirmationWidget: React.FC<BaseWidgetProps> = ({
  data,
  onAction,
  entranceEnabled,
  entranceDelay,
  entranceDuration,
}) => {
  // Data is passed directly - use as TaskData
  const task: TaskData = data as TaskData;
  // Normalize category display name for UI (prefer explicit display from payload, then server meta, then raw key)
  const categoryDisplayNormalized = getCategoryDisplay(task.category, task.categoryDisplay);

  const widgetEntranceProps = getWidgetEntranceProps({ entranceEnabled, entranceDelay, entranceDuration });

  return (
    <Widget {...widgetEntranceProps}>
      <ScrollView style={styles.container} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
        {/* Header */}

        {/* Title */}
        <TaskTitle title={task.title} taskname={task.taskname} category={task.category} />

        {/* Description */}
        {task.description ? (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              Description
            </AppText>
            <AppText variant="bodyText">{task.description}</AppText>
          </View>
        ) : null}

        {/* Due Date */}

        {/* Category / Subcategory / importance / effort */}
        <TaskTagsRow
          category={task.category}
          categoryDisplay={categoryDisplayNormalized}
          subcategory={task.subcategory}
          subcategoryDisplay={task.subcategoryDisplay || task.subCategory?.label}
          importance={task.importance}
          effort={task.effort}
        />

        {/* Details Grid (2-up) */}
        <TwoColumnGrid
          items={[
            renderTaskField({ dueDate: task.dueDate || task.deadline }, "dueDate"),
            renderTaskField(task, "startDate"),
            renderTaskField({ estimatedDuration: task.estimatedDuration || task.duration }, "estimatedDuration"),
            renderTaskField(task, "earliestStart"),
            renderTaskField(task, "taskType"),
            task.status !== "draft" ? renderTaskField(task, "progressPercentage") : null,
            renderTaskField(task, "canSplit"),
            renderTaskField(task, "sessionRange"),
            renderTaskField(task, "recurrence"),
            renderTaskField(task, "chunkCount"),
            renderTaskField(task, "chunkMinutes"),
            renderTaskField(task, "minChunk"),
          ].filter(Boolean)}
        />

        {/* Scheduled Sessions (use shared component) */}
        <ScheduledSessionsSection
          taskId={task.id}
          taskTitle={task.title || task.taskname || "Untitled task"}
          scheduledSessions={task.scheduledSessions}
          subtasks={task.subtasks}
          category={task.category}
          categoryColor={getCategoryMeta(task.category)?.color}
          estimatedDuration={task.estimatedDuration || task.duration}
          progressPercentage={task.status === "draft" ? null : (task.progressPercentage ?? null)}
        />

        {/* Subtasks */}
        {task.subtasks && task.subtasks.length > 0 && (
          <View style={styles.section}>
            <AppText variant="title3" style={styles.sectionTitle}>
              ✓ Subtasks ({task.subtasks.filter((st) => st.completed || st.status === "completed").length}/
              {task.subtasks.length})
            </AppText>
            <View style={styles.subtaskList}>
              {task.subtasks.map((subtask, index) => (
                <View key={subtask.id || `subtask-${index}`} style={styles.subtaskCard}>
                  <AppText
                    variant="bodyText"
                    style={[
                      styles.subtaskTitle,
                      (subtask.completed || subtask.status === "completed") && styles.subtaskCompleted,
                    ]}
                  >
                    {subtask.completed || subtask.status === "completed" ? "✓ " : "○ "}
                    {subtask.title}
                  </AppText>
                  {subtask.description ? (
                    <AppText variant="notes" style={styles.subtaskDescription}>
                      {subtask.description}
                    </AppText>
                  ) : null}
                  {(subtask.duration || subtask.minutes) && (
                    <AppText variant="notes" style={styles.subtaskDuration}>
                      {formatDuration(subtask.duration || subtask.minutes || 0)}
                    </AppText>
                  )}
                </View>
              ))}
            </View>
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
    gap: SPACING.sm,
  },
  notesText: {
    fontStyle: "italic",
    marginTop: SPACING.sm,
  },
  confirmMessage: {
    marginVertical: SPACING.md,
    alignItems: "center",
  },
  section: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: SPACING.sm,
  },
  scheduleList: {
    gap: SPACING.sm,
  },
  scheduleCard: {
    backgroundColor: COLORS.white2,
    padding: SPACING.sm,
    borderRadius: SPACING.md,
    borderLeftWidth: SPACING.xs,
    borderLeftColor: COLORS.primary1,
    gap: 2,
  },
  scheduleLabel: {
    fontWeight: "600",
  },
  scheduleDateTime: {
    color: COLORS.primary1,
    fontWeight: "500",
  },
  scheduleTime: {
    color: COLORS.darkGray,
  },
  subtaskList: {
    gap: SPACING.sm,
  },
  subtaskCard: {
    backgroundColor: COLORS.white2,
    padding: SPACING.sm,
    borderRadius: SPACING.sm,
    borderLeftWidth: SPACING.xs,
    borderLeftColor: COLORS.darkGray,
  },
  subtaskTitle: {
    fontWeight: "500",
  },
  subtaskCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.darkGray,
  },
  subtaskDescription: {
    color: COLORS.darkGray,
    marginTop: SPACING.xs,
  },
  subtaskDuration: {
    color: COLORS.primary1,
    marginTop: SPACING.sm,
  },
  // actions and button styles removed while buttons are disabled
});

export default TaskConfirmationWidget;

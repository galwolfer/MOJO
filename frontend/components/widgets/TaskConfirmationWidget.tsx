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
} from "./widgetHelpers";
import {
  TaskTitle,
  TaskTagsRow,
  TaskDueDate,
  TaskDurationRow,
  ScheduledSessionsSection,
  renderTaskField,
  TwoColumnGrid,
} from "./TaskWidgetParts";

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
}

/**
 * TaskConfirmationWidget - Renders task details for confirmation
 * Note: data comes directly from the widget, no nested 'task' object
 */
const TaskConfirmationWidget: React.FC<BaseWidgetProps> = ({
  data,
  entranceEnabled,
  entranceDelay,
  entranceDuration,
}) => {
  // Data is passed directly - use as TaskData
  const task: TaskData = data as TaskData;

  // Debug: Log the received data to see what's coming from the backend
  console.log("[TaskConfirmationWidget] Received data:", JSON.stringify(data, null, 2));

  return (
    <Widget entranceEnabled={entranceEnabled} entranceDelay={entranceDelay} entranceDuration={entranceDuration}>
      <ScrollView style={styles.container} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
        {/* Header */}

        {/* Title */}
        <TaskTitle title={task.title} taskname={task.taskname} category={task.category} />

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

        {/* Category / Subcategory / importance / effort */}
        <TaskTagsRow
          category={task.category}
          categoryDisplay={task.categoryDisplay}
          subcategory={task.subcategory}
          subcategoryDisplay={task.subcategoryDisplay || task.subCategory?.label}
          importance={task.importance}
          effort={task.effort}
        />

        {/* Details Grid (2-up) */}
        <TwoColumnGrid
          items={[
            <TaskDueDate dueDate={task.dueDate} deadline={task.deadline} />,
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

        {/* Tags (keep original tag display) */}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              🏷️ Tags
            </AppText>
            <AppText variant="bodyText">{task.tags.join(", ")}</AppText>
          </View>
        )}

        {/* Scheduled Sessions (use shared component) */}
        <ScheduledSessionsSection
          scheduledSessions={task.scheduledSessions}
          subtasks={task.subtasks}
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
                  {subtask.description && (
                    <AppText variant="notes" style={styles.subtaskDescription}>
                      {subtask.description}
                    </AppText>
                  )}
                  {subtask.duration && (
                    <AppText variant="notes" style={styles.subtaskDuration}>
                      ⏱️ {formatDuration(subtask.duration)}
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
    borderRadius: 8,
    borderLeftWidth: 3,
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
    fontSize: 12,
  },
  subtaskList: {
    gap: SPACING.sm,
  },
  subtaskCard: {
    backgroundColor: COLORS.white2,
    padding: SPACING.sm,
    borderRadius: 6,
    borderLeftWidth: 2,
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
    fontSize: 12,
    marginTop: 2,
  },
  subtaskDuration: {
    color: COLORS.primary1,
    fontSize: 11,
    marginTop: 4,
  },
  // actions and button styles removed while buttons are disabled
});

export default TaskConfirmationWidget;

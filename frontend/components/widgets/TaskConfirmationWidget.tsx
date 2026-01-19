/**
 * Task Confirmation Widget
 * Displays task details for user confirmation before creating/updating
 */

import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import AppText from "../common/AppText";
import { COLORS, SPACING } from "../../theme";
import Widget from "../special/Widget";
import { BaseWidgetProps } from "../../utils/widgetFactory";

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
const TaskConfirmationWidget: React.FC<BaseWidgetProps> = ({ data }) => {
  // Data is passed directly - use as TaskData
  const task: TaskData = data as TaskData;

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

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "Not scheduled";
    try {
      const date = new Date(dateStr);
      const dateText = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const timeText = date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      return `${dateText} at ${timeText}`;
    } catch {
      return dateStr;
    }
  };

  const formatTimeRange = (session?: ScheduledSession) => {
    if (!session?.start) return "Time TBD";
    try {
      const start = new Date(session.start);
      const end = session.end ? new Date(session.end) : null;
      const startText = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      if (!end || Number.isNaN(end.getTime())) return startText;
      const endText = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `${startText} - ${endText}`;
    } catch {
      return "Time TBD";
    }
  };

  const getSessionLabel = (session: ScheduledSession, index: number) => {
    if (session.subtaskTitle) return session.subtaskTitle;
    if (session.subtaskIndex) return `Part ${session.subtaskIndex}`;
    return `Session ${index + 1}`;
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

  const formatDuration = (minutes?: number) => {
    if (!minutes) return "Not set";
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
    return `${hours}h ${mins}m`;
  };

  const getTaskTypeLabel = (taskType?: string, canSplit?: boolean) => {
    if (taskType === "in_parts") return "Split into parts";
    if (taskType === "leaky") return "Flexible timing";
    if (canSplit) return "Can be split";
    return "Single block";
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
          <AppText variant="bodyText">{formatDate(task.dueDate || task.deadline)}</AppText>
        </View>

        {/* Earliest Start */}
        {task.earliestStart && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              ⏰ Earliest Start
            </AppText>
            <AppText variant="bodyText">{formatDate(task.earliestStart)}</AppText>
          </View>
        )}

        {/* Category */}
        {task.category && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              📁 Category
            </AppText>
            <AppText variant="bodyText">{task.categoryDisplay || task.category}</AppText>
          </View>
        )}

        {/* Subcategory */}
        {(task.subcategory || task.subCategory?.label) && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              📂 Subcategory
            </AppText>
            <AppText variant="bodyText">
              {task.subcategoryDisplay || task.subCategory?.label || task.subcategory}
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

        {/* Priority Score */}
        {task.priorityScore !== undefined && task.priorityScore !== null && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              🎯 Priority Score
            </AppText>
            <AppText variant="bodyText">{task.priorityScore.toFixed(2)}</AppText>
          </View>
        )}

        {/* Estimated Duration */}
        {(task.estimatedDuration || task.duration) && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              ⏱️ Estimated Duration
            </AppText>
            <AppText variant="bodyText">{formatDuration(task.estimatedDuration || task.duration)}</AppText>
          </View>
        )}

        <View style={styles.field}>
          <AppText variant="notes" style={styles.labelText}>
            Progress
          </AppText>
          <AppText variant="bodyText">{Math.round(task.progressPercentage ?? 0)}%</AppText>
        </View>

        {/* Task Type & Splitting */}
        {(task.taskType || task.canSplit) && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              🔀 Task Type
            </AppText>
            <AppText variant="bodyText">{getTaskTypeLabel(task.taskType, task.canSplit)}</AppText>
          </View>
        )}

        {/* Session Range for Leaky Tasks */}
        {task.taskType === "leaky" && task.minMinutes && task.maxMinutes && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              ⏲️ Session Range
            </AppText>
            <AppText variant="bodyText">
              {task.minMinutes}-{task.maxMinutes} min
            </AppText>
          </View>
        )}

        {/* Chunk Info for Split Tasks */}
        {task.taskType === "in_parts" && task.chunkCount && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              🧩 Parts
            </AppText>
            <AppText variant="bodyText">
              {task.chunkCount} chunks
              {task.chunkMinutes ? ` × ${task.chunkMinutes} min` : ""}
            </AppText>
          </View>
        )}

        {/* Splitting (Legacy Display) */}
        {task.canSplit && !task.taskType && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              🔀 Splitting
            </AppText>
            <AppText variant="bodyText">
              {task.taskType === "in_parts" && task.chunkCount
                ? `${task.chunkCount} parts`
                : task.taskType === "leaky"
                  ? `Flexible (${task.minMinutes || 15}-${task.maxMinutes || 60} min)`
                  : "Can be split"}
            </AppText>
          </View>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <View style={styles.field}>
            <AppText variant="notes" style={styles.labelText}>
              🏷️ Tags
            </AppText>
            <AppText variant="bodyText">{task.tags.join(", ")}</AppText>
          </View>
        )}

        {/* Scheduled Sessions */}
        {task.scheduledSessions && task.scheduledSessions.length > 0 && (
          <View style={styles.section}>
            <AppText variant="title3" style={styles.sectionTitle}>
              📅 Scheduled Sessions
            </AppText>
            <View style={styles.scheduleList}>
              {task.scheduledSessions.map((session, index) => (
                <View key={session.id || session.start || `session-${index}`} style={styles.scheduleCard}>
                  <AppText variant="bodyText" style={styles.scheduleLabel}>
                    {getSessionLabel(session, index)}
                  </AppText>
                  <AppText variant="notes" style={styles.scheduleDateTime}>
                    {formatDateTime(session.start)}
                  </AppText>
                  {session.end && (
                    <AppText variant="notes" style={styles.scheduleTime}>
                      {formatTimeRange(session)}
                    </AppText>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

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
  confirmText: {
    color: COLORS.darkGray,
  },
  section: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: SPACING.xs,
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

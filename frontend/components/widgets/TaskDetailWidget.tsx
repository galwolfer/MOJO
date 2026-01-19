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
  taskname?: string;
  description?: string;
  dueDate?: string;
  deadline?: string;
  startDate?: string;
  status?: string;
  importance?: number;
  effort?: number;
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
  notes?: string;
  progressPercentage?: number;
  scheduledSessions?: ScheduledSession[];
  subtasks?: Subtask[];
  estimatedDuration?: number;
  duration?: number;
  priorityScore?: number;
  taskType?: string;
  canSplit?: boolean;
  minChunk?: number | null;
  chunkCount?: number | null;
  chunkMinutes?: number | null;
  minMinutes?: number | null;
  maxMinutes?: number | null;
  earliestStart?: string | null;
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

  const getSessionLabel = (session: ScheduledSession, index: number) => {
    if (session.subtaskTitle) return session.subtaskTitle;
    if (session.subtaskIndex) return `Part ${session.subtaskIndex}`;
    return `Session ${index + 1}`;
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
            <AppText variant="bodyText">{formatDate(task.dueDate || task.deadline)}</AppText>
          </View>

          {task.startDate && (
            <View style={styles.detailItem}>
              <AppText variant="notes" style={styles.labelText}>
                🗓️ Start Date
              </AppText>
              <AppText variant="bodyText">{formatDate(task.startDate)}</AppText>
            </View>
          )}

          {task.earliestStart && (
            <View style={styles.detailItem}>
              <AppText variant="notes" style={styles.labelText}>
                ⏰ Earliest Start
              </AppText>
              <AppText variant="bodyText">{formatDate(task.earliestStart)}</AppText>
            </View>
          )}

          <View style={styles.detailItem}>
            <AppText variant="notes" style={styles.labelText}>
              ⚡ Importance
            </AppText>
            <AppText variant="bodyText">{getImportanceLabel(task.importance)}</AppText>
          </View>

          <View style={styles.detailItem}>
            <AppText variant="notes" style={styles.labelText}>
              💪 Effort
            </AppText>
            <AppText variant="bodyText">{getEffortLabel(task.effort)}</AppText>
          </View>

          {task.priorityScore !== undefined && task.priorityScore !== null && (
            <View style={styles.detailItem}>
              <AppText variant="notes" style={styles.labelText}>
                🎯 Priority Score
              </AppText>
              <AppText variant="bodyText">{task.priorityScore.toFixed(2)}</AppText>
            </View>
          )}

          <View style={styles.detailItem}>
            <AppText variant="notes" style={styles.labelText}>
              Progress
            </AppText>
            <AppText variant="bodyText">{Math.round(task.progressPercentage ?? 0)}%</AppText>
          </View>

          {(task.estimatedDuration || task.duration) && (
            <View style={styles.detailItem}>
              <AppText variant="notes" style={styles.labelText}>
                ⏱️ Duration
              </AppText>
              <AppText variant="bodyText">{formatDuration(task.estimatedDuration || task.duration)}</AppText>
            </View>
          )}

          {task.category && (
            <View style={styles.detailItem}>
              <AppText variant="notes" style={styles.labelText}>
                📁 Category
              </AppText>
              <AppText variant="bodyText">{task.categoryDisplay || task.category}</AppText>
            </View>
          )}

          {(task.subcategory || task.subCategory?.label) && (
            <View style={styles.detailItem}>
              <AppText variant="notes" style={styles.labelText}>
                📂 Subcategory
              </AppText>
              <AppText variant="bodyText">
                {task.subcategoryDisplay || task.subCategory?.label || task.subcategory}
              </AppText>
            </View>
          )}

          {task.taskType && (
            <View style={styles.detailItem}>
              <AppText variant="notes" style={styles.labelText}>
                🔀 Task Type
              </AppText>
              <AppText variant="bodyText">{getTaskTypeLabel(task.taskType, task.canSplit)}</AppText>
            </View>
          )}

          {task.taskType === "leaky" && task.minMinutes && task.maxMinutes && (
            <View style={styles.detailItem}>
              <AppText variant="notes" style={styles.labelText}>
                ⏲️ Session Range
              </AppText>
              <AppText variant="bodyText">
                {task.minMinutes}-{task.maxMinutes} min
              </AppText>
            </View>
          )}

          {task.taskType === "in_parts" && task.chunkCount && (
            <View style={styles.detailItem}>
              <AppText variant="notes" style={styles.labelText}>
                🧩 Parts
              </AppText>
              <AppText variant="bodyText">
                {task.chunkCount} chunks
                {task.chunkMinutes ? ` × ${task.chunkMinutes} min` : ""}
              </AppText>
            </View>
          )}

          {task.tags && task.tags.length > 0 && (
            <View style={[styles.detailItem, { width: "100%" }]}>
              <AppText variant="notes" style={styles.labelText}>
                🏷️ Tags
              </AppText>
              <AppText variant="bodyText">{task.tags.join(", ")}</AppText>
            </View>
          )}
        </View>

        {/* Scheduled Sessions */}
        {task.scheduledSessions && task.scheduledSessions.length > 0 && (
          <View style={styles.section}>
            <AppText variant="title3" style={styles.sectionTitle}>
              📅 Scheduled Sessions
            </AppText>
            <View style={styles.scheduleList}>
              {task.scheduledSessions.map((session, index) => (
                <View key={session.id || session.start || `session-${index}`} style={styles.scheduleCard}>
                  <View style={styles.scheduleHeader}>
                    <AppText variant="bodyText" style={styles.scheduleLabel}>
                      {getSessionLabel(session, index)}
                    </AppText>
                    {session.status && (
                      <View style={[styles.sessionStatusBadge, { backgroundColor: getStatusStyle(session.status) }]}>
                        <AppText variant="notes" style={styles.sessionStatusText}>
                          {session.status}
                        </AppText>
                      </View>
                    )}
                  </View>
                  <AppText variant="notes" style={styles.scheduleDateTime}>
                    {formatDateTime(session.start)}
                  </AppText>
                  {session.end && (
                    <AppText variant="notes" style={styles.scheduleTime}>
                      Duration: {formatTimeRange(session)}
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
                  <View style={styles.subtaskHeader}>
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
                  </View>
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
  scheduleList: {
    gap: SPACING.md,
  },
  scheduleCard: {
    backgroundColor: COLORS.white2,
    padding: SPACING.sm,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary1,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  scheduleLabel: {
    fontWeight: "600",
    flex: 1,
  },
  scheduleDateTime: {
    color: COLORS.primary1,
    fontWeight: "500",
    marginBottom: 2,
  },
  scheduleTime: {
    color: COLORS.darkGray,
    fontSize: 12,
  },
  sessionStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sessionStatusText: {
    fontSize: 9,
    fontWeight: "600",
    color: COLORS.colorWhite,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: SPACING.sm,
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
  subtaskHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  subtaskTitle: {
    fontWeight: "500",
    flex: 1,
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
  // actions and actionButton styles removed while buttons are disabled
});

export default TaskDetailWidget;

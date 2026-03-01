/**
 * Task Confirmation Widget
 * Displays task details for user confirmation before creating/updating
 */

import React, { useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import AppText from "../common/AppText";
import { Checkbox } from "../icons/Checkbox";
import { ICONS } from "../icons/icons";
import { COLORS, ICON_SIZES, SPACING } from "../../theme";
import { useColors } from "../../context/ThemeContext";
import Widget from "../special/Widget";
import { BaseWidgetProps } from "../../utils/widgetFactory";
import List from "../layout/List";
import {
  formatDate,
  formatDateTime,
  formatTimeRange,
  formatDuration,
  getSessionLabel,
  getTaskTypeLabel,
} from "./taskHelpers";
import { getWidgetEntranceProps } from "./widgetHelpers";
import { TaskTitle, TaskTagsRow, ScheduledSessionsSection, renderTaskField, TwoColumnGrid } from "../special/task";
import { getCategoryMeta } from "../../config/categoryMeta";
import { getCategoryDisplay } from "./taskHelpers";

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
    name?: string;
    icon?: string | null;
    parent?: string;
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
  const colors = useColors();
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
            <AppText variant="notes" style={[styles.labelText, { color: colors.gray2 }]}>
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
          subcategoryDisplay={task.subcategoryDisplay || task.subCategory?.label || task.subCategory?.name}
          subCategory={task.subCategory}
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
            <AppText variant="boldText" style={{ color: getCategoryMeta(task.category)?.color || COLORS.primary1 }}>
              {`${task.subtasks.length}`} Subtasks
            </AppText>
            <List
              data={task.subtasks.map((subtask, index) => ({
                id: subtask.id || `subtask-${index}`,
                content: (
                  <View style={styles.subtaskCard}>
                    <View style={styles.subtaskTitleRow}>
                      <View style={styles.subtaskTitleCheck}>
                        <Checkbox checked={subtask.completed || subtask.status === "completed"} size={16} />
                        <AppText
                          variant="bodyText"
                          style={[
                            styles.subtaskTitle,
                            (subtask.completed || subtask.status === "completed") && [
                              styles.subtaskCompleted,
                              { color: colors.gray2 },
                            ],
                          ]}
                        >
                          {subtask.title}
                        </AppText>
                      </View>

                      {(subtask.duration || subtask.minutes) && (
                        <View style={styles.subtaskDurationRow}>
                          <AppText
                            variant="notes"
                            style={{ color: getCategoryMeta(task.category)?.color || COLORS.primary1 }}
                          >
                            {formatDuration(subtask.duration || subtask.minutes || 0)}
                          </AppText>
                          <ICONS.clock
                            size={ICON_SIZES.sm / 2}
                            color={getCategoryMeta(task.category)?.color || COLORS.primary1}
                          />
                        </View>
                      )}
                    </View>
                    {subtask.description ? (
                      <AppText variant="notes" style={[styles.subtaskDescription, { color: colors.gray2 }]}>
                        {subtask.description}
                      </AppText>
                    ) : null}
                  </View>
                ),
                divider: index < (task.subtasks?.length || 0) - 1,
              }))}
              dividerColor={colors.bg2}
            />
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
    paddingBottom: SPACING.sm,
  },
  headerTitle: {
    fontWeight: "600",
  },
  field: {
    marginBottom: SPACING.md,
    gap: 4,
  },
  labelText: {},

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

  scheduleList: {
    gap: SPACING.sm,
  },
  scheduleCard: {
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
  scheduleTime: {},

  subtaskCard: {
    width: "100%",
  },
  subtaskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: SPACING.sm,
    flex: 1,
  },
  subtaskTitleCheck: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  subtaskDurationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  subtaskTitle: {
    fontWeight: "500",
  },
  subtaskCompleted: {
    textDecorationLine: "line-through",
  },
  subtaskDuration: {
    color: COLORS.primary1,
  },
  subtaskDescription: {
    marginTop: SPACING.xs,
    marginLeft: SPACING.sm,
  },

  // actions and button styles removed while buttons are disabled
});

export default TaskConfirmationWidget;

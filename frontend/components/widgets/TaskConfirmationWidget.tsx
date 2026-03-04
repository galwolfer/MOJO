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
import { getCategoryMeta, resolveCategoryKey } from "../../config/categoryMeta";
import { getCategoryDisplay } from "./taskHelpers";

/**
 * Normalizes the raw widget data payload coming from the model.
 * The model may output:
 *  - snake_case field names  (task_name, can_split, estimated_duration …)
 *  - category as a display name ("Social Activity") instead of a key ("social_activity")
 *  - recurrence as a plain string + top-level interval/count instead of a nested object
 *  - subcategory "Uncategorized" which is not meaningful as a sub-label
 * All existing camelCase fields are preserved via spread; overrides come after.
 */
function normalizeConfirmationData(raw: Record<string, any>): TaskData {
  // Recurrence: model may emit a plain string + top-level interval / count
  let recurrence = raw.recurrence;
  if (typeof recurrence === "string" && recurrence.trim() !== "") {
    recurrence = {
      type: recurrence,
      interval: typeof raw.interval === "number" ? raw.interval : undefined,
      count: typeof raw.count === "number" ? raw.count : undefined,
      endDate: raw.end_date ?? raw.endDate ?? undefined,
    };
  }

  // Suppress "Uncategorized" subcategory — it adds no information
  const subcategory =
    raw.subcategory && raw.subcategory.toLowerCase() !== "uncategorized" ? raw.subcategory : undefined;

  return {
    ...(raw as any),
    // Title — model uses task_name, components use title/taskname
    title: raw.title || raw.taskname || raw.task_name || "",
    taskname: raw.taskname || raw.task_name || raw.title || "",
    // Resolve category: display name ("Social Activity") → key ("social_activity")
    category: resolveCategoryKey(raw.category),
    categoryDisplay: undefined, // always re-derive from resolved key
    subcategory,
    // camelCase normalization for snake_case model fields
    estimatedDuration: raw.estimatedDuration ?? raw.estimated_duration,
    canSplit: raw.canSplit ?? raw.can_split,
    chunkMinutes: raw.chunkMinutes ?? raw.chunk_minutes,
    chunkCount: raw.chunkCount ?? raw.chunk_count,
    minChunk: raw.minChunk ?? raw.min_chunk,
    minMinutes: raw.minMinutes ?? raw.min_minutes,
    maxMinutes: raw.maxMinutes ?? raw.max_minutes,
    earliestStart: raw.earliestStart ?? raw.earliest_start,
    // Normalized recurrence object
    recurrence,
  } as TaskData;
}

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
  const colors = useColors();
  // Normalize category display name for UI (prefer explicit display from payload, then server meta, then raw key)
  const task: TaskData = normalizeConfirmationData(data as Record<string, any>);
  // Derive display name from the now-resolved category key
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

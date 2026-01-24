/**
 * Task Detail Widget
 * Displays detailed information about a single task
 */

import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Image, useWindowDimensions } from "react-native";
import AppText from "../common/AppText";
import AppButton from "../common/AppButton";
import { COLORS, SPACING, ICON_SIZES, paletteIndexFromKey, getPalettePair } from "../../theme";
import Widget from "../special/Widget";
import Tag from "../inputs/tag";
import { ICONS } from "../icons/icons";
import { ProgressIcon } from "../icons/ProgressIcon";
import { BaseWidgetProps } from "../../utils/widgetFactory";
import { Checkbox } from "../icons/Checkbox";
import { getCategoryMeta } from "../../config/categoryMeta";
import List, { ListCellProps, ListCellPart } from "../layout/List";
import Icon from "../icons/Icon";
import {
  ScheduledSession,
  Subtask,
  formatDate,
  formatDateTime,
  formatTimeRange,
  getStatusStyle,
  getImportanceLabel,
  getEffortLabel,
  formatDuration,
  getTaskTypeLabel,
  getSessionLabel,
  getSubtaskIdFromSession,
  sessionRowData,
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
import { updateSubTask } from "../../services/taskService";
import { useTaskContext } from "../../context/TaskContext";

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

/**
 * TaskDetailWidget - Renders detailed view of a single task
 */
const TaskDetailWidget: React.FC<BaseWidgetProps> = ({
  data,
  onAction,
  entranceEnabled,
  entranceDelay,
  entranceDuration,
}) => {
  const task: TaskDetail = data.task || data;
  const { notifyTaskUpdate } = useTaskContext();

  const [completedParts, setCompletedParts] = useState<Set<string>>(new Set());
  const [loadingParts, setLoadingParts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const completed = new Set<string>();
    (task.subtasks || []).forEach((st) => {
      if (st.id && (st.completed || st.status === "done" || st.status === "completed")) {
        completed.add(st.id);
      }
    });
    (task.scheduledSessions || []).forEach((s) => {
      const sid = (s as any).subtaskId;
      if (sid && ((s as any).subtaskStatus === "done" || s.status === "completed")) {
        completed.add(sid);
      }
    });
    setCompletedParts(completed);
  }, [task]);

  const handleToggleSubtask = async (subtaskId?: string) => {
    if (!subtaskId) return;
    const isCompleted = completedParts.has(subtaskId);
    const nextCompleted = !isCompleted;

    setCompletedParts((prev) => {
      const updated = new Set(prev);
      if (nextCompleted) updated.add(subtaskId);
      else updated.delete(subtaskId);
      return updated;
    });

    setLoadingParts((prev) => new Set(prev).add(subtaskId));

    try {
      const success = await updateSubTask(task.id, subtaskId, { status: nextCompleted ? "done" : "todo" });
      if (!success) throw new Error("Update failed");

      notifyTaskUpdate({ taskId: task.id });
      onAction?.("subtask_toggled", { taskId: task.id, subtaskId, completed: nextCompleted });
    } catch (error) {
      // revert
      setCompletedParts((prev) => {
        const updated = new Set(prev);
        if (isCompleted) updated.add(subtaskId);
        else updated.delete(subtaskId);
        return updated;
      });
    } finally {
      setLoadingParts((prev) => {
        const updated = new Set(prev);
        updated.delete(subtaskId);
        return updated;
      });
    }
  };

  const sessionSubtaskIds = new Set<string>();
  (task.scheduledSessions || []).forEach((s) => {
    const id = getSubtaskIdFromSession(s, task.subtasks);
    if (id) sessionSubtaskIds.add(id);
  });
  const remainingSubtasks = (task.subtasks || []).filter((st) => !sessionSubtaskIds.has(st.id || ""));

  const categoryMeta = getCategoryMeta(task.category);
  const subLabel = task.subcategoryDisplay || task.subCategory?.label || task.subcategory || "";
  const subIndex = paletteIndexFromKey(subLabel);

  const importanceColorIndex = (imp?: number) => {
    if (!imp) return 8; // gray
    if (imp <= 2) return 6; // green
    if (imp === 3) return 5; // yellow
    return 7; // red
  };

  // Return an ICONS key so Tag will render it using the tag text color
  const importanceIcon = (imp?: number): string => {
    if (!imp) return "list";
    if (imp <= 2) return "lowImportant";
    if (imp === 3) return "mediumImportant";
    return "highPriority";
  };

  const effortColor = (eff?: number) => {
    if (!eff) return 8;
    if (eff <= 2) return 6; // green
    if (eff === 3) return 5; // yellow
    return 7; // red
  };

  // Return ICONS key so Tag will render it with the tag text color
  const effortIcon = (eff?: number): string => {
    if (!eff) return "list";
    if (eff <= 2) return "lowEffort";
    if (eff === 3) return "flame";
    return "highEffort";
  };

  useEffect(() => {
    console.log(`[TaskDetailWidget] entranceEnabled=${entranceEnabled}`);
  }, [entranceEnabled]);

  return (
    <Widget entranceEnabled={entranceEnabled} entranceDelay={entranceDelay} entranceDuration={entranceDuration}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TaskTitle title={task.title} taskname={task.taskname} category={task.category} />
        </View>

        {/* Tags row (category, subcategory, importance, effort) */}
        <TaskTagsRow
          category={task.category}
          categoryDisplay={task.categoryDisplay}
          subcategory={task.subcategory}
          subcategoryDisplay={task.subcategoryDisplay || task.subCategory?.label}
          importance={task.importance}
          effort={task.effort}
        />

        {/* Details Grid */}
        <TwoColumnGrid
          items={[
            <TaskDueDate dueDate={task.dueDate} deadline={task.deadline} />,
            renderTaskField(task, "startDate"),
            renderTaskField(task, "earliestStart"),
            renderTaskField({ estimatedDuration: task.estimatedDuration || task.duration }, "estimatedDuration"),
          ]}
        />

        {/* Description */}
        {task.description && (
          <View style={styles.section}>
            <AppText variant="bodyText">{task.description}</AppText>
          </View>
        )}

        {/* Scheduled Sessions (moved to modular component) */}
        <ScheduledSessionsSection
          scheduledSessions={task.scheduledSessions}
          subtasks={task.subtasks}
          completedParts={completedParts}
          loadingParts={loadingParts}
          onToggleSubtask={handleToggleSubtask}
          estimatedDuration={task.estimatedDuration || task.duration}
          progressPercentage={task.progressPercentage ?? null}
        />
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
    // Ensure title alignment matches TaskTitle textAlign
    textAlign: "left",
  },
  title: {
    color: COLORS.black,
    fontWeight: "600",
    flexShrink: 1,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  inlineIconImage: {
    marginLeft: SPACING.sm,
    marginBottom: -2,
  },
  section: {
    gap: 4,
  },
  labelText: {
    color: COLORS.darkGray,
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
  scheduleList: {
    gap: SPACING.sm,
  },
  scheduleCard: {
    padding: SPACING.sm,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  scheduleLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  scheduleLabel: {
    fontWeight: "600",
    flex: 1,
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  scheduleDateTime: {
    color: COLORS.primary1,
    fontWeight: "700",
    marginBottom: 2,
  },
  scheduleTime: {
    color: COLORS.darkGray,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: SPACING.sm,
  },
  subtaskCard: {
    padding: SPACING.sm,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.darkGray,
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
  },
  subtaskDuration: {
    color: COLORS.primary1,
    fontSize: 11,
    marginTop: 4,
  },
  disabled: {
    opacity: 0.6,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flexWrap: "wrap",
    marginTop: SPACING.sm,
  },
  tagItem: {
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm / 2,
  },
  // actions and actionButton styles removed while buttons are disabled
});

export default TaskDetailWidget;

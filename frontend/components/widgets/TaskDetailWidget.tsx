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
  getCategoryDisplay,
  getSubtaskIdFromSession,
  sessionRowData,
  importanceColorIndex,
  importanceIcon,
  effortColor,
  effortIcon,
  getWidgetEntranceProps,
  toggleSubtask,
  toggleSession,
} from "./widgetHelpers";
import { TaskTitle, TaskTagsRow, ScheduledSessionsSection, renderTaskField, TwoColumnGrid } from "../special/task";
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
    await toggleSubtask({
      taskId: task.id,
      subtaskId,
      completedParts,
      setCompletedParts,
      loadingParts,
      setLoadingParts,
      notifyTaskUpdate,
      onAction,
    });
  };

  const handleToggleSession = async (
    taskIdParam: string,
    session: ScheduledSession,
    index: number,
    subtasksParam?: Subtask[],
  ) => {
    await toggleSession({
      taskId: taskIdParam,
      session,
      index,
      subtasks: subtasksParam || task.subtasks,
      completedParts,
      setCompletedParts,
      loadingParts,
      setLoadingParts,
      notifyTaskUpdate,
      onAction,
    });
  };

  const sessionSubtaskIds = new Set<string>();
  (task.scheduledSessions || []).forEach((s) => {
    const id = getSubtaskIdFromSession(s, task.subtasks);
    if (id) sessionSubtaskIds.add(id);
  });
  const remainingSubtasks = (task.subtasks || []).filter((st) => !sessionSubtaskIds.has(st.id || ""));

  const categoryMeta = getCategoryMeta(task.category);
  const categoryDisplayNormalized = getCategoryDisplay(task.category, task.categoryDisplay);
  const subLabel = task.subcategoryDisplay || task.subCategory?.label || task.subcategory || "";
  const subIndex = paletteIndexFromKey(subLabel);

  const contentNodes: React.ReactNode[] = [
    /* Header */
    <View style={styles.header} key="header">
      <TaskTitle title={task.title} taskname={task.taskname} category={task.category} />
    </View>,

    /* Tags row (category, subcategory, importance, effort) */
    <TaskTagsRow
      key="tags"
      category={task.category}
      categoryDisplay={categoryDisplayNormalized}
      subcategory={task.subcategory}
      subcategoryDisplay={task.subcategoryDisplay || task.subCategory?.label}
      importance={task.importance}
      effort={task.effort}
    />,

    /* Details Grid */
    <TwoColumnGrid
      key="grid"
      items={[
        renderTaskField({ dueDate: task.dueDate || task.deadline }, "dueDate"),
        renderTaskField(task, "startDate"),
        renderTaskField(task, "earliestStart"),
        renderTaskField({ estimatedDuration: task.estimatedDuration || task.duration }, "estimatedDuration"),
      ]}
    />,

    /* Description */
    task.description ? (
      <View style={styles.section} key="desc">
        <AppText variant="bodyText">{task.description}</AppText>
      </View>
    ) : null,

    /* Scheduled Sessions (moved to modular component) */
    <View style={styles.ScheduledSessionsSectionContainer} key="sessionsSection">
      <ScheduledSessionsSection
        key="sessions"
        taskId={task.id}
        taskTitle={task.title || task.taskname || "Untitled task"}
        scheduledSessions={task.scheduledSessions}
        subtasks={task.subtasks}
        completedParts={completedParts}
        loadingParts={loadingParts}
        onToggleSession={handleToggleSession}
        estimatedDuration={task.estimatedDuration || task.duration}
        progressPercentage={task.progressPercentage ?? null}
        sessionHeaderMode="date"
        dividerColor={COLORS.white}
      />
    </View>,
  ];

  const widgetEntranceProps = getWidgetEntranceProps({ entranceEnabled, entranceDelay, entranceDuration });

  return (
    <Widget {...widgetEntranceProps}>
      <View style={styles.container}>{contentNodes}</View>
    </Widget>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
    width: "100%",
    alignSelf: "stretch",
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
    marginBottom: -SPACING.xs,
  },
  section: {
    gap: SPACING.sm,
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
    gap: SPACING.xs,
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
    marginBottom: SPACING.sm,
  },
  ScheduledSessionsSectionContainer: {
    marginStart: SPACING.sm,
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
    marginBottom: SPACING.xs,
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
    borderLeftWidth: SPACING.xs,
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
  },
  subtaskDuration: {
    color: COLORS.primary1,
    marginTop: SPACING.xs,
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
    marginBottom: SPACING.xs,
  },
  // actions and actionButton styles removed while buttons are disabled
});

export default TaskDetailWidget;

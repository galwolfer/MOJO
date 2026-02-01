/**
 * Task List Widget
 * Displays a list of tasks with checkboxes, due dates, and basic details
 */

import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../common/AppText";
import Tag from "../inputs/tag";
import Icon from "../icons/Icon";
import { COLORS, SPACING, ICON_SIZES } from "../../theme";
import Widget from "../special/Widget";
import List, { ListCellProps } from "../layout/List";
import { getCategoryMeta } from "../../config/categoryMeta";
import { BaseWidgetProps } from "../../utils/widgetFactory";
import { useTaskContext } from "../../context/TaskContext";
import { completeTask, toggleTaskCompletion } from "../../services/taskService";
import { TaskTagsRow, ScheduledSessionsSection, getSessionKey } from "../special/task";
import { getCategoryDisplay, computeTaskProgress } from "./taskHelpers";
import { toggleSessionSmart, handleTaskPress, getWidgetEntranceProps } from "./widgetHelpers";
import { getTaskProgress } from "../../services/taskService";
import { useTaskUpdateSubscription } from "../../context/TaskContext";
import { ProgressIcon } from "../icons/ProgressIcon";
import ExpandableRow from "../common/animations/ExpandableRow";

interface Task {
  id: string;
  title: string;
  status?: string;
  dueDate?: string;
  importance?: number;
  effort?: number;
  progressPercentage?: number;
  scheduledSessions?: ScheduledSession[];
  category?: string;
  categoryDisplay?: string;
  subcategory?: string;
  subcategoryDisplay?: string;
  estimatedDuration?: number;
  tags?: string[];
  subtasks?: any[];
}

interface ScheduledSession {
  id?: string;
  start?: string;
  end?: string;
  status?: string;
  subtaskIndex?: number;
  subtaskId?: string;
  subtaskTitle?: string;
  subtaskStatus?: string;
}

/**
 * TaskListWidget - Renders a list of tasks
 */
const TaskListWidget: React.FC<BaseWidgetProps> = ({
  data,
  onAction,
  entranceEnabled,
  entranceDelay,
  entranceDuration,
}) => {
  const tasks: Task[] = data.tasks || [];
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());
  const { notifyTaskUpdate } = useTaskContext();

  // Selected task id (only one task may be selected/expanded at a time)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // Track completion of parts (scheduled sessions / subtasks) by a session key
  const [completedParts, setCompletedParts] = useState<Set<string>>(new Set());
  const [loadingParts, setLoadingParts] = useState<Set<string>>(new Set());

  // Debug: log whenever selectedTaskId changes
  useEffect(() => {}, [selectedTaskId]);

  // Listen for task updates and refresh progress for tasks in this list
  const refreshTaskProgress = async (taskId: string) => {
    try {
      const progress = await getTaskProgress(taskId);
      if (!progress) return;

      // Normalize subtasks returned by API (some use _id)
      const apiSubtasks = (progress.subtasks || []).map((s: any) => ({
        id: s._id || s.id,
        status: s.status,
        completed: s.status === "done",
        order: s.index,
      }));

      const newKeys = new Set<string>();
      apiSubtasks.forEach((st: any) => {
        if (st.id && (st.completed || st.status === "done")) newKeys.add(st.id);
      });

      (progress.scheduledSessions || []).forEach((s: any, idx: number) => {
        const key = getSessionKey(taskId, s, idx, apiSubtasks as any);
        const isDone =
          s.subtaskStatus === "done" || s.status === "completed" || (s.subtaskId && newKeys.has(s.subtaskId));
        if (isDone) newKeys.add(key);
      });

      const subtaskIdSet = new Set(apiSubtasks.map((s: any) => s.id));

      // Merge: remove old keys for this task, add refreshed keys
      setCompletedParts((prev) => {
        const next = new Set(prev);
        for (const k of Array.from(prev)) {
          if (k.startsWith(`${taskId}-`) || subtaskIdSet.has(k)) next.delete(k);
        }
        for (const k of newKeys) next.add(k);
        return next;
      });
    } catch (e) {
      // ignore fetch errors silently
    }
  };

  useTaskUpdateSubscription((payload) => {
    if (!payload?.taskId) return;
    const taskId = payload.taskId;
    // If this widget doesn't show that task, ignore
    const found = tasks.find((t) => t.id === taskId);
    if (!found) return;

    refreshTaskProgress(taskId);
  });

  React.useEffect(() => {
    const nextChecked = new Set<string>();
    tasks.forEach((task) => {
      if (task.status === "done") {
        nextChecked.add(task.id);
      }
    });
    setCheckedTasks(nextChecked);
  }, [tasks]);

  // Task press handling moved to `widgetHelpers.handleTaskPress` to keep widget logic consistent across list/detail views
  // Use: handleTaskPress({ taskId, selectedTaskId, setSelectedTaskId, onAction });

  // derive completed parts (by session key) from scheduled sessions on tasks
  React.useEffect(() => {
    const completed = new Set<string>();
    tasks.forEach((task) => {
      (task.scheduledSessions || []).forEach((session, idx) => {
        const key = getSessionKey(task.id, session, idx, (task as any).subtasks);
        const isDone = (session as any).subtaskStatus === "done" || session.status === "completed";
        if (isDone) completed.add(key);
      });
    });
    setCompletedParts(completed);
  }, [tasks]);

  const handleToggleSession = async (taskId: string, session: ScheduledSession, index: number, subtasks?: any[]) => {
    await toggleSessionSmart({
      taskId,
      session,
      index,
      subtasks,
      completedParts,
      setCompletedParts,
      loadingParts,
      setLoadingParts,
      notifyTaskUpdate,
      onAction,
    });
  };

  const widgetEntranceProps = getWidgetEntranceProps({ entranceEnabled, entranceDelay, entranceDuration });

  if (!tasks || tasks.length === 0) {
    return (
      <Widget
        {...getWidgetEntranceProps({ entranceEnabled, entranceDelay, entranceDuration }, { skipAnimation: true })}
      >
        <AppText variant="notes" style={styles.emptyText}>
          No tasks found
        </AppText>
      </Widget>
    );
  }

  // Build list cells where each cell contains the task header and (optionally) its details
  const cells: ListCellProps[] = tasks.map((task) => {
    const meta = getCategoryMeta(task.category);

    const progressPercent = computeTaskProgress(task, completedParts);
    const progressValue = Math.max(0, Math.min(1, progressPercent / 100));

    const content = (
      <View style={styles.taskItem}>
        <View style={styles.taskContent}>
          <TouchableOpacity
            onPress={() => {
              handleTaskPress({ taskId: task.id, selectedTaskId, setSelectedTaskId, onAction });
            }}
            activeOpacity={0.7}
            style={styles.headerTouchable}
          >
            <View style={styles.titleRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
                {meta?.icon ? (
                  <Icon name={meta.icon} size={ICON_SIZES.sm} color={meta.color} style={styles.titleIcon} />
                ) : null}

                <AppText
                  variant="boldText"
                  numberOfLines={2}
                  style={[styles.taskTitle, checkedTasks.has(task.id) && styles.taskTitleCompleted]}
                >
                  {task.title || (task as any).taskname || "Untitled task"}
                </AppText>
              </View>
              {typeof task.progressPercentage === "number" ||
              ((task as any).subtasks && (task as any).subtasks.length > 0) ||
              (task.scheduledSessions && task.scheduledSessions.length > 0) ? (
                <ProgressIcon
                  key={`progress-${task.id}-${Math.round(progressValue * 100)}`}
                  value={progressValue}
                  size={ICON_SIZES.md}
                />
              ) : (
                <View style={{ width: ICON_SIZES.md }} />
              )}
            </View>
          </TouchableOpacity>

          <ExpandableRow
            expanded={selectedTaskId === task.id}
            style={styles.expandedRow}
            key={`expandable-${task.id}-${selectedTaskId === task.id ? "exp" : "col"}`}
          >
            {/* Normalize category display for presentation */}
            <TaskTagsRow
              category={task.category}
              categoryDisplay={getCategoryDisplay(task.category, task.categoryDisplay)}
              subcategory={task.subcategory}
              subcategoryDisplay={task.subcategoryDisplay}
              importance={task.importance}
              effort={task.effort}
            />

            <ScheduledSessionsSection
              taskId={task.id}
              taskTitle={task.title || (task as any).taskname || "Untitled task"}
              scheduledSessions={task.scheduledSessions}
              subtasks={(task as any).subtasks}
              category={task.category}
              categoryColor={getCategoryMeta(task.category)?.color}
              completedParts={completedParts}
              loadingParts={loadingParts}
              onToggleSession={handleToggleSession}
              estimatedDuration={(task as any).estimatedDuration}
              progressPercentage={task.progressPercentage}
              hideTitle={true}
              hideTaskTitle={false}
              sessionHeaderMode="date"
            />
          </ExpandableRow>
        </View>
      </View>
    );

    return {
      id: task.id,
      content,
      dividerColor: COLORS.white,
    } as ListCellProps;
  });

  return (
    <Widget {...widgetEntranceProps}>
      <View style={styles.container}>
        <List data={cells} />
      </View>
    </Widget>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    justifyContent: "space-between",
    overflow: "hidden",
    flex: 1,
  },
  emptyText: {
    color: COLORS.lightGray,
  },
  taskItem: {
    flexDirection: "row",
    paddingVertical: SPACING.xs,
    gap: SPACING.md,
    width: "100%",
    flex: 1,
  },
  checkbox: {
    paddingRight: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  checkboxBox: {
    width: SPACING.xlg,
    height: SPACING.xlg,
    borderRadius: SPACING.sm,
    borderWidth: SPACING.xs,
    borderColor: COLORS.darkGray,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxBoxChecked: {
    backgroundColor: COLORS.primary6,
    borderColor: COLORS.primary6,
  },

  taskContent: {
    gap: SPACING.sm,
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  titleIcon: {
    marginRight: SPACING.sm,
  },
  taskTitle: {
    fontWeight: "500",
  },
  taskTitleCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  taskMeta: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
  },
  metaText: {
    color: COLORS.darkGray,
  },
  importanceBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: SPACING.xs,
  },
  progressBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: SPACING.xs,
  },
  expandedRow: {
    gap: SPACING.sm,
    paddingLeft: SPACING.sm,
    width: "100%",
    maxWidth: "100%",
    flexShrink: 1,
  },
  headerTouchable: {
    width: "100%",
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    backgroundColor: "blue",
  },
  tagItem: {
    marginRight: SPACING.sm,
    marginBottom: SPACING.xs,
  },
});

export default TaskListWidget;

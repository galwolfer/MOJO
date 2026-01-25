/**
 * Task List Widget
 * Displays a list of tasks with checkboxes, due dates, and basic details
 */

import React, { useState } from "react";
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
import { completeTask, toggleTaskCompletion, updateSubTask } from "../../services/taskService";
import { TaskTagsRow, ScheduledSessionsSection } from "./TaskWidgetParts";
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
const TaskListWidget: React.FC<BaseWidgetProps> = ({ data, onAction }) => {
  const tasks: Task[] = data.tasks || [];
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());
  const { notifyTaskUpdate } = useTaskContext();

  // Selected task id (only one task may be selected/expanded at a time)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // Track completion of parts (scheduled sessions / subtasks) by a session key
  const [completedParts, setCompletedParts] = useState<Set<string>>(new Set());
  const [loadingParts, setLoadingParts] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    const nextChecked = new Set<string>();
    tasks.forEach((task) => {
      if (task.status === "done") {
        nextChecked.add(task.id);
      }
    });
    setCheckedTasks(nextChecked);
  }, [tasks]);

  const handleToggleTask = async (taskId: string) => {
    // Optimistically update UI
    const newChecked = new Set(checkedTasks);
    const wasChecked = newChecked.has(taskId);

    if (wasChecked) {
      newChecked.delete(taskId);
    } else {
      newChecked.add(taskId);
    }
    setCheckedTasks(newChecked);

    // Track loading state
    setLoadingTasks((prev) => new Set(prev).add(taskId));

    try {
      // Call API to toggle/complete the task
      if (!wasChecked) {
        // Completing the task
        console.log(`[TaskListWidget] Completing task with ID: ${taskId}`);
        const result = await completeTask(taskId);
        console.log(`[TaskListWidget] Complete result:`, result);
      } else {
        // Uncompleting - use toggle
        console.log(`[TaskListWidget] Toggling task with ID: ${taskId}`);
        await toggleTaskCompletion(taskId);
      }

      // Notify other components (like UserProfile) to refresh (scope update to this task)
      notifyTaskUpdate({ taskId });

      // Also call the onAction callback for any additional handling
      onAction?.("task_toggled", { taskId, checked: !wasChecked });
    } catch (error) {
      console.warn("Failed to toggle task:", error);
      // Revert optimistic update on error
      const revertChecked = new Set(checkedTasks);
      if (wasChecked) {
        revertChecked.add(taskId);
      } else {
        revertChecked.delete(taskId);
      }
      setCheckedTasks(revertChecked);
    } finally {
      setLoadingTasks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const getSessionKey = (taskId: string, session: ScheduledSession, index: number) => {
    const subId = (session as any).subtaskId || (session as any).subtaskId;
    return subId || session.id || `${taskId}-${session.start || `session-${index}`}`;
  };

  const handleTaskPress = (taskId: string) => {
    // Ensure only one task is selected at a time; tapping the same task collapses it
    setSelectedTaskId((prev) => (prev === taskId ? null : taskId));
    onAction?.("task_selected", { taskId });
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // derive completed parts (by session key) from scheduled sessions on tasks
  React.useEffect(() => {
    const completed = new Set<string>();
    tasks.forEach((task) => {
      (task.scheduledSessions || []).forEach((session, idx) => {
        const key = getSessionKey(task.id, session, idx);
        const isDone = (session as any).subtaskStatus === "done" || session.status === "completed";
        if (isDone) completed.add(key);
      });
    });
    setCompletedParts(completed);
  }, [tasks]);

  const handleToggleSession = async (taskId: string, session: ScheduledSession, index: number) => {
    const subtaskId = (session as any).subtaskId || undefined;
    const key = getSessionKey(taskId, session, index);
    const canPersist = Boolean(subtaskId);

    const isCompleted = completedParts.has(key);
    const nextCompleted = !isCompleted;

    setCompletedParts((prev) => {
      const updated = new Set(prev);
      if (nextCompleted) updated.add(key);
      else updated.delete(key);
      return updated;
    });

    if (canPersist) setLoadingParts((prev) => new Set(prev).add(key));

    try {
      if (canPersist && subtaskId) {
        const success = await updateSubTask(taskId, subtaskId, { status: nextCompleted ? "done" : "todo" });
        if (!success) throw new Error("Update failed");
      }

      notifyTaskUpdate({ taskId });
      onAction?.("part_toggled", {
        taskId,
        sessionId: session.id,
        subtaskId: subtaskId || null,
        completed: nextCompleted,
        synthetic: !canPersist,
      });
    } catch (error) {
      // revert
      setCompletedParts((prev) => {
        const updated = new Set(prev);
        if (isCompleted) updated.add(key);
        else updated.delete(key);
        return updated;
      });
    } finally {
      if (canPersist)
        setLoadingParts((prev) => {
          const updated = new Set(prev);
          updated.delete(key);
          return updated;
        });
    }
  };

  const getImportanceColor = (importance?: number) => {
    if (!importance) return COLORS.darkGray;
    if (importance <= 2) return COLORS.primary6;
    if (importance <= 3) return COLORS.primary5;
    return COLORS.primary7;
  };

  const getProgressColor = (progress?: number) => {
    const value = typeof progress === "number" ? progress : 0;
    if (value >= 80) return COLORS.primary6;
    if (value >= 40) return COLORS.primary5;
    return COLORS.primary7;
  };

  const formatTimeRange = (session?: ScheduledSession) => {
    if (!session?.start) return null;
    try {
      const start = new Date(session.start);
      const end = session.end ? new Date(session.end) : null;
      const startText = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      if (!end || Number.isNaN(end.getTime())) return startText;
      const endText = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `${startText} - ${endText}`;
    } catch {
      return null;
    }
  };

  if (!tasks || tasks.length === 0) {
    return (
      <Widget skipAnimation>
        <AppText variant="notes" style={styles.emptyText}>
          No tasks found
        </AppText>
      </Widget>
    );
  }

  // Build list cells where each cell contains the task header and (optionally) its details
  const cells: ListCellProps[] = tasks.map((task) => {
    const meta = getCategoryMeta(task.category);

    const content = (
      <View style={{ width: "100%" }}>
        <View style={styles.taskItem}>
          <View style={styles.taskContent}>
            <View style={styles.titleRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1 }}>
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

              {typeof task.progressPercentage === "number" ? (
                <ProgressIcon
                  value={Math.max(0, Math.min(1, (task.progressPercentage || 0) / 100))}
                  size={ICON_SIZES.md}
                />
              ) : (
                <View style={{ width: ICON_SIZES.md }} />
              )}
            </View>

            <ExpandableRow expanded={selectedTaskId === task.id} style={styles.expandedRow}>
              {(task as any).tags && Array.isArray((task as any).tags) && (task as any).tags.length > 0 ? (
                <View style={styles.tagContainer}>
                  {(task as any).tags.map((t: string, i: number) => (
                    <Tag key={i} label={t} style={styles.tagItem} />
                  ))}
                </View>
              ) : null}

              <TaskTagsRow
                category={task.category}
                categoryDisplay={task.categoryDisplay}
                subcategory={task.subcategory}
                subcategoryDisplay={task.subcategoryDisplay}
                importance={task.importance}
                effort={task.effort}
              />

              <ScheduledSessionsSection
                scheduledSessions={task.scheduledSessions}
                subtasks={(task as any).subtasks}
                completedParts={completedParts}
                loadingParts={loadingParts}
                onToggleSubtask={(subtaskId: string) => {
                  const sessions = task.scheduledSessions || [];
                  const idx = sessions.findIndex((s: any) => (s as any).subtaskId === subtaskId || s.id === subtaskId);
                  const session = sessions[idx] || sessions[0];
                  handleToggleSession(task.id, session, idx >= 0 ? idx : 0);
                }}
                estimatedDuration={(task as any).estimatedDuration}
                progressPercentage={task.progressPercentage}
                hideTitle={true}
              />
            </ExpandableRow>
          </View>
        </View>
      </View>
    );

    return {
      id: task.id,
      content,
      onPress: () => handleTaskPress(task.id),
    } as ListCellProps;
  });

  return (
    <Widget>
      <List data={cells} />
    </Widget>
  );
};

const styles = StyleSheet.create({
  container: {
    // expanded: no maxHeight so the widget can grow to fit content
  },
  emptyText: {
    color: COLORS.lightGray,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: SPACING.xs,
    gap: SPACING.md,
  },
  checkbox: {
    paddingRight: SPACING.sm,
    paddingTop: 2,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.darkGray,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxBoxChecked: {
    backgroundColor: COLORS.primary6,
    borderColor: COLORS.primary6,
  },
  checkmark: {
    fontSize: 12,
    color: COLORS.colorWhite,
    fontWeight: "600",
  },
  taskContent: {
    flex: 1,
    gap: 4,
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
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  importanceText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.colorWhite,
  },
  progressBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.colorWhite,
  },
  expandedRow: {
    gap: SPACING.sm,
    paddingLeft: SPACING.sm,
    backgroundColor: "transparent",
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  tagItem: {
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm / 2,
  },
});

export default TaskListWidget;

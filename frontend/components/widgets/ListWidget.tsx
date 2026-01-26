/**
 * ListWidget
 * Unified widget wrapper that fetches live data based on listType.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import AppText from "../common/AppText";
import Widget from "../special/Widget";
import { BaseWidgetProps } from "../../utils/widgetFactory";
import {
  getOverdueTasks,
  getScheduledTasksByDay,
  getTaskProgress,
  getTasks,
  ScheduledSession,
  Task,
  TaskProgressData,
} from "../../services/taskService";
import { useTaskUpdateSubscription } from "../../context/TaskContext";
import { getCategoryMeta } from "../../config/categoryMeta";
import { COLORS } from "../../theme";
import TaskDetailWidget from "./TaskDetailWidget";
import TaskListWidget from "./TaskListWidget";
import UpcomingTasksWidget from "./UpcomingTasksWidget";
import { getWidgetEntranceProps } from "./widgetHelpers";

type ListWidgetData = {
  listType?: string;
  list_type?: string;
  tasks?: Array<{ id?: string; title?: string }>;
  taskId?: string;
  title?: string;
  days?: number;
  filters?: {
    category?: string;
    completed?: boolean;
    dueBefore?: string;
    dueAfter?: string;
    search?: string;
  };
};

const DEFAULT_SCHEDULE_DAYS = 7;

const ListWidget: React.FC<BaseWidgetProps> = ({
  data,
  onAction,
  entranceEnabled,
  entranceDelay,
  entranceDuration,
}) => {
  const payload = data as ListWidgetData;
  const listType = useMemo(() => (payload.listType || payload.list_type || "task_list").toLowerCase(), [payload]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewData, setViewData] = useState<Record<string, any> | null>(null);

  const mapTask = useCallback((task: Task, scheduledSessions?: ScheduledSession[]) => {
    const id = (task as any).id || task._id;
    const title = (task as any).title || task.taskname || "Untitled";
    const categoryMeta = getCategoryMeta(task.category);

    return {
      id,
      title,
      taskname: task.taskname,
      description: task.description || "",
      status: task.status,
      dueDate: task.dueDate || null,
      importance: task.importance,
      effort: task.effort,
      estimatedDuration: task.estimatedDuration,
      priorityScore: task.priorityScore ?? null,
      progressPercentage: typeof task.progressPercentage === "number" ? task.progressPercentage : 0,
      taskType: task.taskType || null,
      canSplit: task.canSplit,
      minChunk: task.minChunk ?? null,
      chunkCount: task.chunkCount ?? null,
      chunkMinutes: task.chunkMinutes ?? null,
      minMinutes: task.minMinutes ?? null,
      maxMinutes: task.maxMinutes ?? null,
      earliestStart: task.earliestStart ?? null,
      category: task.category || null,
      categoryDisplay: categoryMeta.displayName,
      subCategory: task.subCategory || null,
      subcategory: task.subCategory?.label || null,
      subcategoryDisplay: task.subCategory?.label || null,
      tags: task.tags || null,
      scheduledSessions: scheduledSessions || [],
      subtasks: [] as Array<Record<string, any>>,
    };
  }, []);

  const mergeScheduledSessions = useCallback(
    (tasks: Array<Record<string, any>>, schedule: Awaited<ReturnType<typeof getScheduledTasksByDay>> | null) => {
      if (!schedule) return tasks;
      const map = new Map<string, ScheduledSession[]>();
      const groups = [schedule.today, ...(schedule.upcoming || [])];

      groups.forEach((group) => {
        group?.tasks?.forEach((task) => {
          if (!task?.id) return;
          if (!map.has(task.id)) map.set(task.id, []);
          const sessions = map.get(task.id);
          sessions?.push(...(task.scheduledSessions || []));
        });
      });

      map.forEach((sessions, taskId) => {
        sessions.sort((a, b) => {
          const aTime = a.start ? new Date(a.start).getTime() : 0;
          const bTime = b.start ? new Date(b.start).getTime() : 0;
          return aTime - bTime;
        });
        map.set(taskId, sessions);
      });

      return tasks.map((task) => ({
        ...task,
        scheduledSessions: map.get(task.id) || task.scheduledSessions || [],
      }));
    },
    [],
  );

  const resolveTaskId = useCallback(() => {
    if (payload.taskId) return payload.taskId;
    const candidate = payload.tasks && payload.tasks.length > 0 ? payload.tasks[0] : null;
    return candidate?.id || null;
  }, [payload.taskId, payload.tasks]);

  const loadData = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent;
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        if (listType === "task_detail") {
          const taskId = resolveTaskId();
          if (!taskId) throw new Error("Missing task id");

          const progress = await getTaskProgress(taskId);
          if (!progress) throw new Error("Task not found");

          const scheduledSessions =
            progress.scheduledSessions && progress.scheduledSessions.length > 0
              ? progress.scheduledSessions
              : (progress.subtasks || []).flatMap((sub) => sub.scheduledSessions || []);

          const mapped = mapTask(progress.task, scheduledSessions);
          mapped.subtasks = (progress.subtasks || []).map((sub) => ({
            id: sub._id,
            title: sub.title,
            description: sub.description,
            status: sub.status,
            completed: sub.status === "done",
            order: sub.index,
            duration: sub.minutes,
          }));
          mapped.progressPercentage =
            typeof progress.progressPercentage === "number" ? progress.progressPercentage : mapped.progressPercentage;

          setViewData({ task: mapped });
          return;
        }

        if (listType === "upcoming_tasks") {
          const days = payload.days ?? DEFAULT_SCHEDULE_DAYS;
          const schedule = await getScheduledTasksByDay(days);
          if (!schedule) throw new Error("Failed to load schedule");
          setViewData(schedule);
          return;
        }

        let tasks: Task[] = [];
        if (listType === "overdue_tasks") {
          tasks = await getOverdueTasks();
        } else {
          tasks = await getTasks(payload.filters || undefined);
        }

        const schedule = tasks.length > 0 ? await getScheduledTasksByDay(DEFAULT_SCHEDULE_DAYS) : null;

        const mappedTasks = tasks.map((task) => mapTask(task));
        const merged = mergeScheduledSessions(mappedTasks, schedule);

        setViewData({ tasks: merged });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load tasks";
        if (!silent) {
          setError(message);
          setViewData(null);
        } else {
          // Use debug to avoid noisy warnings for expected transient failures (e.g., eventual consistency after updates)
          console.debug("ListWidget: silent load failed:", message);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [listType, mapTask, mergeScheduledSessions, payload.days, payload.filters, resolveTaskId],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Use a silent refresh on task updates so we don't replace the visible UI
  // If payload contains a taskId and it doesn't match our resolved detail id, skip refresh.
  useTaskUpdateSubscription((payload) => {
    try {
      const resolved = resolveTaskId();
      if (resolved && payload?.taskId && payload.taskId !== resolved) {
        // Not relevant to this widget instance
        return;
      }
    } catch (e) {
      // fallback to refreshing
    }
    loadData({ silent: true });
  });

  const widgetEntranceProps = getWidgetEntranceProps({ entranceEnabled, entranceDelay, entranceDuration });

  if (loading) {
    return (
      <Widget {...getWidgetEntranceProps({ entranceEnabled, entranceDelay, entranceDuration }, { skipAnimation: true })}>
        <AppText variant="notes" style={styles.stateText}>
          Loading tasks...
        </AppText>
      </Widget>
    );
  }

  if (error) {
    return (
      <Widget {...getWidgetEntranceProps({ entranceEnabled, entranceDelay, entranceDuration }, { skipAnimation: true })}>
        <AppText variant="notes" style={styles.stateText}>
          {error}
        </AppText>
      </Widget>
    );
  }

  if (!viewData) {
    return null;
  }

  switch (listType) {
    case "task_detail":
      return <TaskDetailWidget data={viewData} onAction={onAction} {...widgetEntranceProps} />;

    case "upcoming_tasks":
      return <UpcomingTasksWidget data={viewData} onAction={onAction} {...widgetEntranceProps} />;
    case "overdue_tasks":
      return <TaskListWidget data={viewData} onAction={onAction} {...widgetEntranceProps} />;
    case "task_list":
    default:
      return <TaskListWidget data={viewData} onAction={onAction} {...widgetEntranceProps} />;
  }
};

const styles = StyleSheet.create({
  stateText: {
    color: COLORS.darkGray,
  },
});

export default ListWidget;

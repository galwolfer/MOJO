/**
 * Upcoming Tasks Widget
 * Shows scheduled tasks for today and the next N days, with part completion.
 */

import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import AppText from "../common/AppText";
import Widget from "../special/Widget";
import { BaseWidgetProps } from "../../utils/widgetFactory";
import { COLORS, ICON_SIZES, SPACING } from "../../theme";
import { updateSubTask } from "../../services/taskService";
import { useTaskContext } from "../../context/TaskContext";
import { useOptionalStatsContext } from "../../context/StatsContext";
import { ProgressIcon } from "../icons/ProgressIcon";
import { Checkbox } from "../icons/Checkbox";
import Icon from "../icons/Icon";
import Tag from "../inputs/tag";
import List, { ListCellProps } from "../layout/List";
import { getCategoryMeta } from "../../config/categoryMeta";
import { ScheduledSessionsSection, getSessionKey } from "../special/task";
import {
  ScheduledSession,
  Subtask,
  formatDate,
  formatDuration,
  getSubtaskIdFromSession,
  getTimeParts,
  computeTaskProgress,
  getWidgetEntranceProps,
} from "./widgetHelpers";

type TaskItem = {
  id: string;
  title: string;
  taskname?: string;
  status?: string;
  dueDate?: string;
  importance?: number;
  effort?: number;
  category?: string;
  categoryDisplay?: string;
  subcategory?: string;
  subcategoryDisplay?: string;
  progressPercentage?: number;
  estimatedDuration?: number;
  earliestStart?: string | null;
  scheduledSessions?: ScheduledSession[];
  subtasks?: Subtask[];
};

type DayGroup = {
  date?: string | null;
  tasks?: TaskItem[];
};

type UpcomingTasksData = {
  days?: number;
  today?: DayGroup;
  upcoming?: DayGroup[];
};

const UpcomingTasksWidget: React.FC<BaseWidgetProps> = ({
  data,
  onAction,
  entranceEnabled,
  entranceDelay,
  entranceDuration,
}) => {
  const payload = data as UpcomingTasksData;
  const { notifyTaskUpdate } = useTaskContext();
  const { notifyStatsChange } = useOptionalStatsContext();
  const { width } = useWindowDimensions();

  const [completedParts, setCompletedParts] = useState<Set<string>>(new Set());
  const [loadingParts, setLoadingParts] = useState<Set<string>>(new Set());

  const todayGroup = useMemo(() => payload.today || { date: undefined, tasks: [] }, [payload.today]);
  const upcomingGroups = useMemo(() => payload.upcoming || [], [payload.upcoming]);
  const daysLabel = payload.days ? `${payload.days} days` : "next days";

  useEffect(() => {
    const completed = new Set<string>();

    const collect = (tasks?: TaskItem[]) => {
      tasks?.forEach((task) => {
        task.scheduledSessions?.forEach((session, index) => {
          const subtaskId = getSubtaskIdFromSession(session, task.subtasks);
          const key = subtaskId || session.id || `${task.id}-${session.start || `session-${index}`}`;
          const isDone = session.subtaskStatus === "done" || session.status === "completed";

          if (isDone) {
            completed.add(key);
          }
        });
      });
    };

    collect(todayGroup.tasks);
    upcomingGroups.forEach((group) => collect(group.tasks));
    setCompletedParts(completed);
  }, [todayGroup.tasks, upcomingGroups]);

  const totalToday = todayGroup.tasks?.length || 0;
  const completedToday =
    todayGroup.tasks?.filter((task) => task.status === "done" || task.status === "completed").length || 0;
  const todayProgress = totalToday > 0 ? Math.max(0, Math.min(1, completedToday / Math.max(1, totalToday))) : null;

  const formatDayLabel = (dateKey?: string | null) => {
    if (!dateKey) return "Unknown date";
    return formatDate(`${dateKey}T00:00:00`);
  };

  const handleToggleSession = async (
    taskId: string,
    session: ScheduledSession,
    index: number,
    subtasks?: Subtask[],
  ) => {
    const subtaskId = getSubtaskIdFromSession(session, subtasks);
    const key = getSessionKey(taskId, session, index, subtasks);
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
        const result = await updateSubTask(taskId, subtaskId, {
          status: nextCompleted ? "done" : "todo",
        });
        if (!result.success) throw new Error("Update failed");
        
        // Notify stats change if gamification data was returned
        if (result.gamification) {
          console.log("[UpcomingTasksWidget] Gamification update:", result.gamification);
          notifyStatsChange(result.gamification);
        }
        
        await new Promise((resolve) => setTimeout(resolve, 300));
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

  const buildTaskCell = (task: TaskItem): ListCellProps => {
    const categoryMeta = getCategoryMeta(task.category);
    const hasScheduledSessions = (task.scheduledSessions || []).length > 0;

    const content = (
      <View style={{ width: "100%", paddingStart: SPACING.md }}>
        {hasScheduledSessions ? (
          <ScheduledSessionsSection
            taskId={task.id}
            taskTitle={task.title || task.taskname || "Untitled task"}
            scheduledSessions={task.scheduledSessions}
            subtasks={task.subtasks}
            category={task.category}
            categoryColor={categoryMeta?.color}
            completedParts={completedParts}
            loadingParts={loadingParts}
            onToggleSession={handleToggleSession}
            hideTitle={false}
            hideTaskTitle={true}
            sessionHeaderMode="taskTitle"
            dividerColor={COLORS.white}
          />
        ) : (
          <AppText variant="notes" style={styles.emptySessions}>
            No scheduled sessions
          </AppText>
        )}
      </View>
    );

    return {
      id: task.id,
      content,
      onPress: undefined,
    } as ListCellProps;
  };

  const renderDaySection = (
    group: DayGroup,
    label: string,
    emptyLabel: string,
    options?: { emptyProgress?: number },
  ) => {
    const tasks = group.tasks || [];
    const isSessionDone = (task: TaskItem, session: ScheduledSession, index: number) => {
      const key = getSessionKey(task.id, session, index, task.subtasks);
      if (completedParts.has(key)) return true;
      return session.subtaskStatus === "done" || session.status === "completed";
    };

    const completedCount = tasks.filter((task) => {
      if (task.status === "done" || task.status === "completed") return true;
      const sessions = task.scheduledSessions || [];
      if (sessions.length === 0) return false;
      return sessions.every((session, index) => isSessionDone(task, session, index));
    }).length;

    const progressValue =
      tasks.length > 0
        ? tasks.reduce((acc, t) => acc + computeTaskProgress(t, completedParts) / 100, 0) / tasks.length
        : (options?.emptyProgress ?? 0);
    const colorIndex = ((label.charCodeAt(0) + label.length) % 7) + 1;
    return (
      <View style={styles.dayGroup}>
        <View style={styles.dayHeader}>
          <View style={styles.dayHeaderTitle}>
            <ProgressIcon value={progressValue} size={ICON_SIZES.sm} />
            <AppText variant="notes" style={styles.sectionTitle}>
              {label}
            </AppText>
          </View>
          <Tag label={`${tasks.length} task${tasks.length === 1 ? "" : "s"}`} colorIndex={colorIndex} />
        </View>

        {tasks.length === 0 ? (
          <AppText variant="notes" style={styles.emptyText}>
            {emptyLabel}
          </AppText>
        ) : (
          <View style={styles.listContainer}>
            <List dividerColor={COLORS.white} data={tasks.map((task) => buildTaskCell(task))} />
          </View>
        )}
      </View>
    );
  };

  const buildDayCell = (group: DayGroup, label: string, emptyLabel: string, options?: { emptyProgress?: number }) => {
    const id = group.date || label;
    const content = renderDaySection(group, label, emptyLabel, options);
    return { id, content } as ListCellProps;
  };

  const dayCells: ListCellProps[] = [
    buildDayCell(todayGroup, "Today", "No tasks scheduled for today"),
    ...upcomingGroups.map((group, index) =>
      buildDayCell(group, formatDayLabel(group.date) || `Day ${index + 1}`, "No scheduled tasks", {
        emptyProgress: 1,
      }),
    ),
  ];

  const widgetEntranceProps = getWidgetEntranceProps({ entranceEnabled, entranceDelay, entranceDuration });

  return (
    <Widget {...widgetEntranceProps}>
      <View style={styles.header}>
        <View>
          <AppText variant="notes" style={styles.headerSubtitle}>
            Your tasks for the next {daysLabel}
          </AppText>
        </View>
      </View>

      <List data={dayCells} dividerColor={COLORS.white} />
    </Widget>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
    gap: SPACING.md,
    minWidth: 450,
  },
  headerTitle: {
    color: COLORS.black,
    fontWeight: "700",
    width: "100%",
  },
  headerSubtitle: {
    color: COLORS.darkGray,
  },
  headerBadge: {
    backgroundColor: COLORS.white,
    borderRadius: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  headerBadgeText: {
    color: COLORS.darkGray,
    fontWeight: "600",
  },
  headerProgressSpacer: {
    width: ICON_SIZES.md,
    height: ICON_SIZES.md,
  },
  dayGroup: {
    alignItems: "flex-start",
    gap: SPACING.sm,
    width: "100%",
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minWidth: 450,
    width: "100%",
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    gap: SPACING.md,
    flexWrap: "wrap",
  },
  dayHeaderTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginStart: -SPACING.xs,
  },
  sectionTitle: {
    color: COLORS.primary1,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  listContainer: {
    width: "100%",
    marginTop: -SPACING.md,
    marginBottom: SPACING.sm,
    marginStart: -SPACING.sm,
  },
  sectionCount: {
    color: COLORS.lightGray,
  },
  emptyText: {
    color: COLORS.darkGray,
  },
  emptySessions: {
    color: COLORS.darkGray,
  },
});

export default UpcomingTasksWidget;

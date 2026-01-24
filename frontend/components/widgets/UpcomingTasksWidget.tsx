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
import { ProgressIcon } from "../icons/ProgressIcon";
import { Checkbox } from "../icons/Checkbox";
import Icon from "../icons/Icon";
import List, { ListCellProps } from "../layout/List";
import { getCategoryMeta } from "../../config/categoryMeta";
import { ScheduledSession, Subtask, formatDate, formatDuration, getSubtaskIdFromSession } from "./widgetHelpers";

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

const UpcomingTasksWidget: React.FC<BaseWidgetProps> = ({ data, onAction }) => {
  const payload = data as UpcomingTasksData;
  const { notifyTaskUpdate } = useTaskContext();
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

  const getSessionKey = (taskId: string, session: ScheduledSession, index: number, subtasks?: Subtask[]) => {
    const subtaskId = getSubtaskIdFromSession(session, subtasks);
    return subtaskId || session.id || `${taskId}-${session.start || `session-${index}`}`;
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
        const success = await updateSubTask(taskId, subtaskId, {
          status: nextCompleted ? "done" : "todo",
        });
        if (!success) throw new Error("Update failed");
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

  const getTimeParts = (dateStr?: string) => {
    if (!dateStr) return { time: "", ampm: "" };
    try {
      const date = new Date(dateStr);
      const minutes = date.getMinutes();
      const rawHours = date.getHours();
      const ampm = rawHours >= 12 ? "PM" : "AM";
      const hours12 = rawHours % 12 === 0 ? 12 : rawHours % 12;
      const time = `${hours12}:${minutes.toString().padStart(2, "0")}`;
      return { time, ampm };
    } catch {
      return { time: "", ampm: "" };
    }
  };

  const buildSessionCells = (task: TaskItem): ListCellProps[] => {
    const sessions = task.scheduledSessions || [];
    if (sessions.length === 0) return [];

    const categoryMeta = getCategoryMeta(task.category);
    const taskTitle = task.title || task.taskname || "Untitled task";

    return sessions.map((session, index) => {
      const subtaskId = getSubtaskIdFromSession(session, task.subtasks);
      const key = getSessionKey(task.id, session, index, task.subtasks);
      const isDone = completedParts.has(key);
      const canToggle = Boolean(subtaskId) || Boolean(session.id);
      const isLoading = loadingParts.has(key);
      const startParts = getTimeParts(session.start);
      const endParts = getTimeParts(session.end);

      return {
        id: key,
        content: (
          <View style={styles.sessionRow}>
            <View style={styles.sessionTimeBlock}>
              <View style={[styles.sessionTimeLine, { backgroundColor: categoryMeta?.color || COLORS.primary1 }]} />
              <View style={styles.sessionTimeColumn}>
                <AppText variant="notes" style={styles.sessionHourText}>
                  {session.start ? (
                    <>
                      {startParts.time || "Time"}
                      {startParts.ampm ? (
                        <AppText variant="notes" style={styles.sessionAmPm}>
                          {" " + startParts.ampm}
                        </AppText>
                      ) : null}
                    </>
                  ) : (
                    "Time"
                  )}
                </AppText>
                <AppText variant="notes" style={styles.sessionHourText}>
                  {session.end ? (
                    <>
                      {endParts.time || ""}
                      {endParts.ampm ? (
                        <AppText variant="notes" style={styles.sessionAmPm}>
                          {" " + endParts.ampm}
                        </AppText>
                      ) : null}
                    </>
                  ) : (
                    ""
                  )}
                </AppText>
              </View>
            </View>
            <View style={styles.sessionCheckbox}>
              {canToggle ? (
                <Checkbox
                  checked={isDone}
                  onChange={() => handleToggleSession(task.id, session, index, task.subtasks)}
                  size={ICON_SIZES.sm}
                />
              ) : (
                <View style={styles.checkboxSpacer} />
              )}
            </View>

            <View style={styles.sessionInfo}>
              <View style={styles.sessionTitleRow}>
                <AppText
                  variant="bodyText"
                  style={[styles.sessionTitleText, isDone && styles.sessionLabelDone]}
                  ellipsizeMode="tail"
                >
                  <AppText variant="boldText" style={styles.sessionSubtask}>
                    {session.subtaskTitle || `Part ${session.subtaskIndex ?? index + 1}`}
                  </AppText>
                  <AppText variant="bodyText" style={styles.sessionTask}>
                    {" - " + taskTitle}
                  </AppText>
                </AppText>
              </View>
            </View>
          </View>
        ),
        onPress: canToggle ? () => handleToggleSession(task.id, session, index, task.subtasks) : undefined,
        disabled: isLoading || !canToggle,
        divider: true,
      } as ListCellProps;
    });
  };

  const buildTaskCell = (task: TaskItem): ListCellProps => {
    const sessionCells = buildSessionCells(task);

    const content = (
      <View style={styles.taskCard}>
        {sessionCells.length > 0 ? (
          <View style={styles.sessionList}>
            <List data={sessionCells} />
          </View>
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

    const progressValue = tasks.length > 0 ? completedCount / Math.max(1, tasks.length) : (options?.emptyProgress ?? 0);
    return (
      <View style={styles.dayGroup}>
        <View style={styles.dayHeader}>
          <View style={styles.dayHeaderTitle}>
            <ProgressIcon value={progressValue} size={ICON_SIZES.sm} />
            <AppText variant="notes" style={styles.sectionTitle}>
              {label}
            </AppText>
          </View>
          <AppText variant="notes" style={styles.sectionCount}>
            {tasks.length} task{tasks.length === 1 ? "" : "s"}
          </AppText>
        </View>

        {tasks.length === 0 ? (
          <AppText variant="notes" style={styles.emptyText}>
            {emptyLabel}
          </AppText>
        ) : (
          <List data={tasks.map((task) => buildTaskCell(task))} />
        )}
      </View>
    );
  };

  return (
    <Widget>
      <View style={styles.header}>
        <View>
          <AppText variant="notes" style={styles.headerSubtitle}>
            Scheduled for {daysLabel}
          </AppText>
        </View>
        <View style={styles.headerBadge}>
          <AppText variant="notes" style={styles.headerBadgeText}>
            {totalToday} today
          </AppText>
        </View>
        {typeof todayProgress === "number" ? (
          <ProgressIcon value={todayProgress} size={ICON_SIZES.md} />
        ) : (
          <View style={styles.headerProgressSpacer} />
        )}
      </View>

      {renderDaySection(todayGroup, "Today", "No tasks scheduled for today")}

      {upcomingGroups.map((group, index) => (
        <View key={group.date || `upcoming-${index}`}>
          {renderDaySection(group, formatDayLabel(group.date) || `Day ${index + 1}`, "No scheduled tasks", {
            emptyProgress: 1,
          })}
        </View>
      ))}
    </Widget>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  headerTitle: {
    color: COLORS.black,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: COLORS.darkGray,
    marginTop: 2,
  },
  headerBadge: {
    backgroundColor: COLORS.white,
    borderRadius: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
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
    alignItems: "stretch",
    gap: SPACING.md,
    marginTop: SPACING.md,
    width: "100%",
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
  },
  dayHeaderTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  sectionTitle: {
    color: COLORS.primary1,
    textTransform: "uppercase",
  },
  sectionCount: {
    color: COLORS.lightGray,
  },
  taskCard: {
    backgroundColor: "transparent",
    borderRadius: 0,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    width: "100%",
  },
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  sessionList: {
    marginTop: SPACING.sm,
    width: "100%",
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    paddingVertical: 4,
    width: "100%",
  },
  sessionTimeBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  sessionTimeColumn: {
    alignItems: "flex-end",
    gap: SPACING.xs,
    minWidth: 46,
  },
  sessionHourText: {
    color: COLORS.lightGray,
  },
  sessionAmPm: {
    fontSize: 10,
    color: COLORS.lightGray,
  },
  sessionTimeLine: {
    width: SPACING.xs,
    alignSelf: "stretch",
    borderRadius: 999,
  },
  sessionCheckbox: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
  },
  sessionInfo: {
    flex: 1,
    gap: 2,
  },
  sessionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: SPACING.xs,
  },
  sessionTime: {
    color: COLORS.primary1,
    fontWeight: "600",
  },
  sessionLabelDone: {
    textDecorationLine: "line-through",
    color: COLORS.darkGray,
  },
  sessionTitleText: {
    flexShrink: 1,
  },
  sessionSubtask: {
    fontWeight: "600",
  },
  sessionTask: {
    color: COLORS.black,
  },
  inlineIcon: {
    marginLeft: 4,
    marginBottom: -1,
  },
  checkboxSpacer: {
    width: ICON_SIZES.sm,
    height: ICON_SIZES.sm,
  },
  sessionMeta: {
    minWidth: 70,
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  sessionDuration: {
    color: COLORS.darkGray,
  },
  sessionDate: {
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

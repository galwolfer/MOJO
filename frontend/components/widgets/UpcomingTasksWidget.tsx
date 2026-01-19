/**
 * Upcoming Tasks Widget
 * Shows scheduled tasks for today and the next N days, with part completion.
 */

import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppText from "../common/AppText";
import Widget from "../special/Widget";
import { BaseWidgetProps } from "../../utils/widgetFactory";
import { COLORS, SPACING } from "../../theme";
import { updateSubTaskStatus } from "../../services/taskService";
import { useTaskContext } from "../../context/TaskContext";

type ScheduledSession = {
  id?: string;
  taskId?: string;
  start?: string;
  end?: string;
  minutes?: number;
  status?: string;
  subtaskIndex?: number;
  subtaskId?: string;
  subtaskTitle?: string;
  subtaskStatus?: string;
};

type TaskItem = {
  id: string;
  title: string;
  status?: string;
  dueDate?: string;
  importance?: number;
  effort?: number;
  category?: string;
  subcategory?: string;
  progressPercentage?: number;
  scheduledSessions?: ScheduledSession[];
};

type DayGroup = {
  date?: string;
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
  const [completedParts, setCompletedParts] = useState<Set<string>>(new Set());
  const [loadingParts, setLoadingParts] = useState<Set<string>>(new Set());

  const todayGroup = payload.today || { date: undefined, tasks: [] };
  const upcomingGroups = payload.upcoming || [];
  const daysLabel = payload.days ? `${payload.days} days` : "next days";

  useEffect(() => {
    const completed = new Set<string>();
    const collect = (tasks?: TaskItem[]) => {
      tasks?.forEach((task) => {
        task.scheduledSessions?.forEach((session) => {
          if (session.subtaskId && session.subtaskStatus === "done") {
            completed.add(session.subtaskId);
          }
        });
      });
    };
    collect(todayGroup.tasks);
    upcomingGroups.forEach((group) => collect(group.tasks));
    setCompletedParts(completed);
  }, [todayGroup.tasks, upcomingGroups]);

  const totalToday = todayGroup.tasks?.length || 0;

  const formatDateLabel = (dateKey?: string) => {
    if (!dateKey) return "Unknown date";
    const parsed = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateKey;
    return parsed.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTimeRange = (session: ScheduledSession) => {
    if (!session.start) return "Time TBD";
    const start = new Date(session.start);
    const end = session.end ? new Date(session.end) : null;
    const startText = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (!end || Number.isNaN(end.getTime())) return startText;
    const endText = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${startText} - ${endText}`;
  };

  const getProgressValue = (value?: number) => {
    if (typeof value !== "number" || Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  };

  const getProgressColor = (value?: number) => {
    const progress = getProgressValue(value);
    if (progress >= 80) return COLORS.primary6;
    if (progress >= 40) return COLORS.primary5;
    return COLORS.primary7;
  };

  const getSessionLabel = (session: ScheduledSession) => {
    if (session.subtaskTitle) return session.subtaskTitle;
    if (session.subtaskIndex) return `Part ${session.subtaskIndex}`;
    return "Session";
  };

  const handleToggleSession = async (taskId: string, session: ScheduledSession) => {
    const key = session.subtaskId;
    if (!key) return;
    const isCompleted = completedParts.has(key);
    const nextCompleted = !isCompleted;

    setCompletedParts((prev) => {
      const updated = new Set(prev);
      if (nextCompleted) updated.add(key);
      else updated.delete(key);
      return updated;
    });

    setLoadingParts((prev) => new Set(prev).add(key));

    try {
      const success = await updateSubTaskStatus(taskId, session.subtaskId, nextCompleted ? "done" : "todo");
      if (!success) {
        throw new Error("Update failed");
      }

      notifyTaskUpdate();
      onAction?.("part_toggled", {
        taskId,
        sessionId: session.id,
        subtaskId: session.subtaskId,
        completed: nextCompleted,
      });
    } catch (error) {
      setCompletedParts((prev) => {
        const updated = new Set(prev);
        if (isCompleted) updated.add(key);
        else updated.delete(key);
        return updated;
      });
    } finally {
      setLoadingParts((prev) => {
        const updated = new Set(prev);
        updated.delete(key);
        return updated;
      });
    }
  };

  const renderTaskCard = (task: TaskItem, allowToggle: boolean) => {
    const sessions = task.scheduledSessions || [];
    const progressValue = getProgressValue(task.progressPercentage);
    const progressColor = getProgressColor(task.progressPercentage);

    return (
      <View key={task.id} style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <View style={[styles.ratingBox, { borderColor: progressColor }]}>
            <AppText variant="title3" style={styles.ratingValue}>
              {progressValue}
            </AppText>
            <AppText variant="notes" style={styles.ratingLabel}>
              PROG
            </AppText>
          </View>
          <View style={styles.taskInfo}>
            <AppText variant="bodyText" numberOfLines={2} style={styles.taskTitle}>
              {task.title}
            </AppText>
            {task.category && (
              <AppText variant="notes" style={styles.taskMeta}>
                {task.category}
              </AppText>
            )}
          </View>
        </View>

        {sessions.length > 0 && (
          <View style={styles.sessionList}>
            {sessions.map((session) => {
              const key = session.subtaskId || session.id || `${task.id}-${session.start}`;
              const isDone = session.subtaskId ? completedParts.has(session.subtaskId) : false;
              const canToggle = allowToggle && Boolean(session.subtaskId);
              const isLoading = session.subtaskId ? loadingParts.has(session.subtaskId) : false;

              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.sessionRow, !canToggle && styles.sessionRowDisabled]}
                  onPress={() => canToggle && handleToggleSession(task.id, session)}
                  activeOpacity={0.7}
                  disabled={!canToggle || isLoading}
                >
                  <View
                    style={[
                      styles.partCheckbox,
                      isDone && styles.partCheckboxDone,
                      !canToggle && styles.partCheckboxDisabled,
                    ]}
                  />
                  <View style={styles.sessionInfo}>
                    <AppText variant="notes" style={styles.sessionTime}>
                      {formatTimeRange(session)}
                    </AppText>
                    <AppText variant="bodyText" style={styles.sessionLabel}>
                      {getSessionLabel(session)}
                    </AppText>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {sessions.length === 0 && (
          <AppText variant="notes" style={styles.emptySessions}>
            No scheduled sessions
          </AppText>
        )}
      </View>
    );
  };

  return (
    <Widget skipAnimation style={styles.widget}>
      <LinearGradient colors={[COLORS.brightP5, COLORS.primary5, COLORS.darkP5]} style={styles.gradient}>
        <View style={styles.header}>
          <View>
            <AppText variant="title3" style={styles.headerTitle}>
              Upcoming Tasks
            </AppText>
            <AppText variant="notes" style={styles.headerSubtitle}>
              Scheduled for {daysLabel}
            </AppText>
          </View>
          <View style={styles.headerBadge}>
            <AppText variant="notes" style={styles.headerBadgeText}>
              {totalToday} today
            </AppText>
          </View>
        </View>

        <View style={styles.dayGroup}>
          <AppText variant="notes" style={styles.sectionTitle}>
            Today
          </AppText>
          {totalToday === 0 ? (
            <AppText variant="notes" style={styles.emptyText}>
              No tasks scheduled for today
            </AppText>
          ) : (
            (todayGroup.tasks || []).map((task) => renderTaskCard(task, true))
          )}
        </View>

        {upcomingGroups.map((group, index) => (
          <View key={group.date || `upcoming-${index}`} style={styles.dayGroup}>
            <AppText variant="notes" style={styles.sectionTitle}>
              {formatDateLabel(group.date)}
            </AppText>
            {(group.tasks || []).length === 0 ? (
              <AppText variant="notes" style={styles.emptyText}>
                No scheduled tasks
              </AppText>
            ) : (
              (group.tasks || []).map((task) => renderTaskCard(task, false))
            )}
          </View>
        ))}
      </LinearGradient>
    </Widget>
  );
};

const styles = StyleSheet.create({
  widget: {
    padding: 0,
    backgroundColor: "transparent",
  },
  gradient: {
    borderRadius: SPACING.lg,
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
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
  dayGroup: {
    gap: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.darkGray,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  taskCard: {
    backgroundColor: COLORS.white,
    borderRadius: SPACING.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    shadowColor: COLORS.shadow15277c14,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  ratingBox: {
    width: 58,
    height: 58,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white2,
  },
  ratingValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  ratingLabel: {
    color: COLORS.darkGray,
    letterSpacing: 1,
  },
  taskInfo: {
    flex: 1,
    gap: 2,
  },
  taskTitle: {
    fontWeight: "600",
  },
  taskMeta: {
    color: COLORS.darkGray,
  },
  sessionList: {
    gap: SPACING.sm,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: 4,
  },
  sessionRowDisabled: {
    opacity: 0.6,
  },
  partCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.darkGray,
    backgroundColor: COLORS.white,
  },
  partCheckboxDone: {
    backgroundColor: COLORS.primary6,
    borderColor: COLORS.primary6,
  },
  partCheckboxDisabled: {
    borderColor: COLORS.lightGray,
  },
  sessionInfo: {
    flex: 1,
    gap: 2,
  },
  sessionTime: {
    color: COLORS.darkGray,
  },
  sessionLabel: {
    fontWeight: "500",
  },
  emptyText: {
    color: COLORS.darkGray,
  },
  emptySessions: {
    color: COLORS.darkGray,
  },
});

export default UpcomingTasksWidget;

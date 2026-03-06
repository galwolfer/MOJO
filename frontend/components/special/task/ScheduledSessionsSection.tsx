import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import AppText from "../../common/AppText";
import TimeRangeDisplay from "../../common/TimeRangeDisplay";
import { CompletionItem } from "./CompletionItem";
import { SessionTime } from "./SessionTime";
import List from "../../layout/List";
import { COLORS, ICON_SIZES, SPACING } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import { ScheduledSession, Subtask as WidgetSubtask, getSessionKey, getTimeParts } from "../../widgets/taskHelpers";
import { Subtask as CalendarSubtask } from "../../../screens/calendar/types";
import { useTaskUpdateSubscription } from "../../../context/TaskContext";
import { ICONS } from "../../icons/icons";
import { TaskTitle } from "./TaskTitle";

export const ScheduledSessionsSection: React.FC<{
  taskId: string;
  taskTitle: string;
  scheduledSessions?: ScheduledSession[];
  category?: string;
  categoryColor?: string;
  completedParts?: Set<string>;
  loadingParts?: Set<string>;
  subtasks?: WidgetSubtask[];
  onToggleSession?: (taskId: string, session: ScheduledSession, index: number, subtasks?: WidgetSubtask[]) => void;
  onRefresh?: (taskId?: string) => void;
  estimatedDuration?: number;
  progressPercentage?: number | null;
  hideTitle?: boolean;
  hideTaskTitle?: boolean;
  dividerColor?: string;
  sessionHeaderMode?: "taskTitle" | "date" | "none";
  taskStatus?: string;
  showCheckbox?: boolean;
  onEditSession?: (taskId: string, session: ScheduledSession, index: number) => void;
  groupByDate?: boolean; // new flag to disable same-day grouping
}> = ({
  taskId,
  taskTitle,
  scheduledSessions,
  category,
  categoryColor,
  completedParts,
  loadingParts,
  subtasks,
  onToggleSession,
  onRefresh,
  hideTitle = false,
  hideTaskTitle = false,
  sessionHeaderMode = "none",
  groupByDate = true,
  dividerColor,
  taskStatus,
  showCheckbox = true,
  onEditSession,
}) => {
  const colors = useColors();
  const resolvedDividerColor = dividerColor ?? colors.bg1;
  // Listen for task updates and invoke parent's refresh when task updates occur elsewhere

  useTaskUpdateSubscription((payload?: { taskId?: string }) => {
    if (!payload || !payload.taskId || payload.taskId === taskId) {
      onRefresh?.(payload?.taskId);
    }
  });

  const sessions = scheduledSessions || [];

  // helper to prepare groups by date (and optionally by short gap) or treat all sessions individually
  interface DateGroup {
    date: string;
    items: { session: ScheduledSession; index: number }[];
    showDateHeader: boolean;
  }

  const dateGroups: DateGroup[] = [];
  if (groupByDate) {
    let prevDate: string | null = null;
    let prevEnd: string = ""; // keep ISO string of previous end (empty if none)
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const date = getTimeParts(session.start).date;

      // determine if we should start a new group
      let startNew = false;
      if (prevDate === null || date !== prevDate) {
        startNew = true;
      } else if (prevEnd) {
        const gapMinutes = (new Date(session.start ?? "").getTime() - new Date(prevEnd).getTime()) / 60000;
        if (gapMinutes > 60) {
          startNew = true;
        }
      }

      if (startNew) {
        const showHeader = prevDate === null || date !== prevDate;
        dateGroups.push({ date, items: [{ session, index: i }], showDateHeader: showHeader });
      } else {
        dateGroups[dateGroups.length - 1].items.push({ session, index: i });
      }

      prevDate = date;
      prevEnd = session.end || "";
    }
  } else {
    // no grouping, each session its own group with empty date prefix
    sessions.forEach((session, i) => {
      dateGroups.push({ date: "", items: [{ session, index: i }], showDateHeader: false });
    });
  }

  // Fallback: when there are no sessions but there are subtasks, render subtasks directly
  if (sessions.length === 0) {
    if (!subtasks || subtasks.length === 0) return null;
    return (
      <View style={{ gap: SPACING.sm, alignSelf: "stretch" }}>
        {!hideTitle && sessionHeaderMode === "taskTitle" ? (
          <TaskTitle title={taskTitle} category={category} size="md" />
        ) : null}
        <List
          dividerColor={resolvedDividerColor}
          data={subtasks.map((st, i) => {
            const id = st.id || String(i);
            const isDone = st.completed || completedParts?.has(id);
            return {
              id,
              divider: i < subtasks.length - 1,
              content: (
                <CompletionItem
                  type="subtask"
                  subtask={{ id, title: st.title, completed: isDone ?? false } as any}
                  parentTaskId={taskId}
                  isCompleted={isDone ?? false}
                  categoryColor={categoryColor}
                  onToggle={() => {}}
                />
              ),
            };
          })}
        />
      </View>
    );
  }

  const titleMode = sessionHeaderMode === "taskTitle";

  const listData = dateGroups.flatMap(({ date, items, showDateHeader }, groupIdx) => {
    if (items.length === 1) {
      // Single session — render as normal SessionRow
      const { session, index } = items[0];
      const key = getSessionKey(taskId, session, index, subtasks);
      const subtaskId = (session as any).subtaskId;
      const isDone = subtaskId
        ? completedParts?.has(key) || session.subtaskStatus === "done" || session.status === "completed"
        : taskStatus === "done" || completedParts?.has(key);

      return [
        {
          id: key,
          divider: true,
          content: (
            <View>
              {/* Show date only for the first item of this day group */}
              {sessionHeaderMode === "date" && showDateHeader && (
                <AppText variant="notes" style={[styles.dateText, { color: categoryColor || COLORS.primary1 }]}>
                  {date}
                </AppText>
              )}
              <CompletionItem
                type="session"
                session={session}
                taskId={taskId}
                categoryColor={categoryColor}
                taskTitle={taskTitle}
                subtasks={subtasks}
                sessionIndex={index}
                isDone={isDone}
                isLoading={loadingParts?.has(key)}
                checkboxOnToggle={
                  showCheckbox && onToggleSession ? () => onToggleSession(taskId, session, index, subtasks) : undefined
                }
                rowOnPress={onToggleSession ? () => onToggleSession(taskId, session, index, subtasks) : undefined}
                canToggle={showCheckbox && !!onToggleSession}
                hideTaskTitle={hideTaskTitle || sessions.length === 1}
                lightTitle={titleMode || hideTaskTitle}
                showEditIcon={!!onEditSession}
                editOnPress={onEditSession ? () => onEditSession(taskId, session, index) : undefined}
              />
            </View>
          ),
          style: { paddingStart: titleMode ? (ICON_SIZES.md - SPACING.xs) / 2 : 0 },
        },
      ];
    }

    // Multiple sessions on the same day — grouped block with single spanning SessionTime
    const firstSession = items[0].session;
    const lastSession = items[items.length - 1].session;

    const groupKey = `group-${taskId}-${groupIdx}`;
    return [
      {
        id: groupKey,
        divider: groupIdx < dateGroups.length - 1,
        content: (
          <View style={{ gap: SPACING.sm }}>
            {/* Show date above the group for the first item of each day */}
            {sessionHeaderMode === "date" && showDateHeader && (
              <AppText variant="notes" style={[styles.dateText, { color: categoryColor || COLORS.primary1 }]}>
                {date}
              </AppText>
            )}
            <View style={styles.groupedBlock}>
              {/* Single time bar spanning first start → last end */}
              <SessionTime timeStart={firstSession.start} timeEnd={lastSession.end} categoryColor={categoryColor} />
              {/* Rows for each session */}
              <View style={styles.groupedRows}>
                {items.map(({ session, index }) => {
                  const key = getSessionKey(taskId, session, index, subtasks);
                  const subtaskId = (session as any).subtaskId;
                  const isDone = subtaskId
                    ? completedParts?.has(key) || session.subtaskStatus === "done" || session.status === "completed"
                    : taskStatus === "done" || completedParts?.has(key);
                  const isLoading = loadingParts?.has(key);
                  const label = session.subtaskTitle || `Part ${session.subtaskIndex ?? index + 1}`;

                  // Build time range element (not a string) using TimeRangeDisplay
                  const timeRangeElement =
                    session.start && session.end ? (
                      <TimeRangeDisplay startIsoString={session.start} endIsoString={session.end} />
                    ) : session.start ? (
                      <TimeRangeDisplay startIsoString={session.start} />
                    ) : undefined;

                  return (
                    <View style={styles.sessionRowWrapper}>
                      <CompletionItem
                        key={key}
                        type="subtask"
                        subtask={{ id: key, title: label, completed: isDone ?? false } as CalendarSubtask}
                        parentTaskId={taskId}
                        isCompleted={isDone ?? false}
                        categoryColor={categoryColor}
                        showTime={!!timeRangeElement}
                        timeRangeElement={timeRangeElement}
                        onToggle={(_parentId: string, _subtaskId: string, _checked: boolean) => {
                          if (!isLoading) onToggleSession?.(taskId, session, index, subtasks);
                        }}
                        showEditIcon={!!onEditSession}
                        editOnPress={onEditSession ? () => onEditSession(taskId, session, index) : undefined}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        ),
        style: { paddingStart: titleMode ? (ICON_SIZES.md - SPACING.xs) / 2 : 0 },
      },
    ];
  });

  return (
    <View style={{ gap: SPACING.sm, alignSelf: "stretch" }}>
      {!hideTitle && sessionHeaderMode === "taskTitle" ? (
        <TaskTitle title={taskTitle} category={category} size="md" />
      ) : null}

      <View
        style={{
          paddingStart: titleMode ? SPACING.sm : 0,
          marginTop: titleMode ? -SPACING.sm : 0,
          marginBottom: titleMode && sessions.length === 0 ? -SPACING.md : 0,
          alignSelf: "stretch",
        }}
      >
        <List dividerColor={resolvedDividerColor} data={listData} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  groupedBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    alignSelf: "stretch",
    width: "100%",
    paddingVertical: 4,
  },
  groupedRows: {
    flex: 1,
    gap: SPACING.xs,
  },
  dateText: {
    fontWeight: "600",
    marginBottom: SPACING.xs,
  },
  sessionRowWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: COLORS.white2 ?? "#F0F0F8",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ScheduledSessionsSection;

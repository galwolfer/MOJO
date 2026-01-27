import React from "react";
import { View } from "react-native";
import AppText from "../../common/AppText";
import SessionRow from "./SessionRow";
import List from "../../layout/List";
import { COLORS, ICON_SIZES, SPACING } from "../../../theme";
import { ScheduledSession, Subtask, getSessionKey } from "../../widgets/widgetHelpers";
import { useTaskUpdateSubscription } from "../../../context/TaskContext";
import TaskTitle from "./TaskTitle";

export const ScheduledSessionsSection: React.FC<{
  taskId: string;
  taskTitle: string;
  scheduledSessions?: ScheduledSession[];
  category?: string;
  categoryColor?: string;
  completedParts?: Set<string>;
  loadingParts?: Set<string>;
  subtasks?: Subtask[];
  onToggleSession?: (taskId: string, session: ScheduledSession, index: number, subtasks?: Subtask[]) => void;
  onRefresh?: (taskId?: string) => void;
  estimatedDuration?: number;
  progressPercentage?: number | null;
  hideTitle?: boolean;
  hideTaskTitle?: boolean;
  dividerColor?: string;
  sessionHeaderMode?: "taskTitle" | "date" | "none";
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
  dividerColor = COLORS.white,
}) => {
  // Listen for task updates and invoke parent's refresh when task updates occur elsewhere
  useTaskUpdateSubscription((payload?: { taskId?: string }) => {
    if (!payload || !payload.taskId || payload.taskId === taskId) {
      onRefresh?.(payload?.taskId);
    }
  });

  const sessions = scheduledSessions || [];
  if (!sessions || sessions.length === 0) {
    return null;
  }

  const titleMode = sessionHeaderMode === "taskTitle";

  return (
    <View style={{ gap: SPACING.sm }}>
      {!hideTitle && sessionHeaderMode === "taskTitle" ? (
        <TaskTitle title={taskTitle} category={category} size="md" />
      ) : null}

      <View
        style={{
          marginStart: titleMode ? SPACING.sm : 0,
          marginTop: titleMode ? -SPACING.sm : 0,
          marginBottom: titleMode && sessions.length === 0 ? -SPACING.lg : 0,
        }}
      >
        <List
          dividerColor={dividerColor}
          data={sessions.map((session, index) => {
            const key = getSessionKey(taskId, session, index, subtasks);
            const isDone =
              completedParts?.has(key) || session.subtaskStatus === "done" || session.status === "completed";
            const id = key;
            return {
              id,
              content: (
                <SessionRow
                  session={session}
                  taskId={taskId}
                  categoryColor={categoryColor}
                  taskTitle={taskTitle}
                  subtasks={subtasks}
                  sessionIndex={index}
                  isDone={isDone}
                  isLoading={loadingParts?.has(key)}
                  checkboxOnToggle={
                    onToggleSession ? () => onToggleSession(taskId, session, index, subtasks) : undefined
                  }
                  rowOnPress={onToggleSession ? () => onToggleSession(taskId, session, index, subtasks) : undefined}
                  canToggle={!!onToggleSession}
                  hideTaskTitle={hideTaskTitle}
                  showTaskDate={sessionHeaderMode === "date"}
                />
              ),
              onPress: onToggleSession ? () => onToggleSession(taskId, session, index, subtasks) : undefined,
              style: { marginStart: sessionHeaderMode === "taskTitle" ? (ICON_SIZES.md - SPACING.xs) / 2 : 0 },
              divider: true,
            };
          })}
        />
      </View>
    </View>
  );
};

export default ScheduledSessionsSection;

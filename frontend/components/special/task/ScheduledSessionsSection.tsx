import React from "react";
import { View } from "react-native";
import AppText from "../../common/AppText";
import SessionRow from "./SessionRow";
import { ICON_SIZES, SPACING } from "../../../theme";
import { ScheduledSession, Subtask } from "../../widgets/widgetHelpers";

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
  estimatedDuration?: number;
  progressPercentage?: number | null;
  hideTitle?: boolean;
  hideTaskTitle?: boolean;
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
  hideTitle = false,
  hideTaskTitle = false,
  sessionHeaderMode = "none",
}) => {
  const sessions = scheduledSessions || [];
  if (!sessions || sessions.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: SPACING.sm }}>
      {!hideTitle && sessionHeaderMode === "taskTitle" ? <AppText variant="boldText">{taskTitle}</AppText> : null}

      {sessions.map((session, index) => {
        const isDone =
          completedParts?.has(session.id || "") || session.subtaskStatus === "done" || session.status === "completed";
        return (
          <View key={session.id || `${taskId}-${index}`}>
            <View style={{ marginStart: sessionHeaderMode === "taskTitle" ? (ICON_SIZES.md - SPACING.xs) / 2 : 0 }}>
              <SessionRow
                session={session}
                taskId={taskId}
                categoryColor={categoryColor}
                taskTitle={taskTitle}
                subtasks={subtasks}
                sessionIndex={index}
                isDone={isDone}
                isLoading={loadingParts?.has(session.id || "")}
                onToggle={onToggleSession ? () => onToggleSession(taskId, session, index, subtasks) : undefined}
                canToggle={!!onToggleSession}
                hideTaskTitle={hideTaskTitle}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default ScheduledSessionsSection;

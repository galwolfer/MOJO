import React from "react";
import { View } from "react-native";
import AppText from "../../common/AppText";
import Icon from "../../icons/Icon";
import List, { ListCellProps } from "../../layout/List";
import { ProgressIcon } from "../../icons/ProgressIcon";
import { getCategoryMeta } from "../../../config/categoryMeta";
import {
  formatDate,
  getSubtaskIdFromSession,
  ScheduledSession,
  Subtask,
  getSessionKey,
  computeTaskProgress,
} from "../widgetHelpers";
import SessionRow from "./SessionRow";
import { StyleSheet } from "react-native";
import { ICON_SIZES, SPACING, COLORS } from "../../../theme";

export const ScheduledSessionsSection: React.FC<{
  taskId: string;
  taskTitle: string;
  scheduledSessions?: ScheduledSession[];
  subtasks?: Subtask[];
  category?: string;
  categoryColor?: string;
  completedParts?: Set<string>;
  loadingParts?: Set<string>;
  onToggleSession?: (
    taskId: string,
    session: ScheduledSession,
    index: number,
    subtasks?: Subtask[],
  ) => void | Promise<void>;
  estimatedDuration?: number | null;
  progressPercentage?: number | null; // 0-100
  hideTitle?: boolean;
  hideTaskTitle?: boolean;
  sessionHeaderMode?: "taskTitle" | "date" | "none";
}> = ({
  taskId,
  taskTitle,
  scheduledSessions,
  subtasks,
  category,
  categoryColor,
  completedParts = new Set(),
  loadingParts = new Set(),
  onToggleSession,
  estimatedDuration,
  progressPercentage = null,
  hideTitle = false,
  hideTaskTitle = false,
  sessionHeaderMode = "none",
}) => {
  if (!scheduledSessions || scheduledSessions.length === 0) return null;

  const categoryMeta = getCategoryMeta(category);

  const items: ListCellProps[] = (scheduledSessions || []).map((session, index) => {
    const key = getSessionKey(taskId, session, index, subtasks);
    const isDone = completedParts.has(key);
    const isLoading = loadingParts.has(key);
    const subtaskId = getSubtaskIdFromSession(session, subtasks);
    const canToggle = Boolean(subtaskId) || Boolean(session.id);

    // Determine what header to show before this session row (only on first session)
    let headerElement: React.ReactNode = null;
    if (sessionHeaderMode === "taskTitle" && index === 0) {
      headerElement = (
        <View style={styles.sessionHeader}>
          {categoryMeta?.icon ? (
            <Icon name={categoryMeta.icon} size={ICON_SIZES.md} color={categoryMeta.color} />
          ) : null}
          <AppText variant="boldText" style={styles.sessionHeaderText}>
            {taskTitle}
          </AppText>
        </View>
      );
    } else if (sessionHeaderMode === "date") {
      const dateSource = session.start || session.end;
      if (dateSource) {
        const dateStr = formatDate(dateSource);
        if (dateStr && dateStr !== "Not set") {
          headerElement = (
            <AppText variant="bodyText" style={styles.sessionDateHeader}>
              {dateStr}
            </AppText>
          );
        }
      }
    }

    return {
      id: key,
      content: (
        <View>
          {headerElement}
          <SessionRow
            session={session}
            taskId={taskId}
            taskTitle={taskTitle}
            categoryColor={categoryColor}
            subtasks={subtasks}
            sessionIndex={index}
            isDone={isDone}
            isLoading={isLoading}
            onToggle={() => onToggleSession?.(taskId, session, index, subtasks)}
            canToggle={canToggle}
            hideTaskTitle={hideTaskTitle}
          />
        </View>
      ),
      onPress: canToggle ? () => onToggleSession?.(taskId, session, index, subtasks) : undefined,
      disabled: isLoading || !canToggle,
      divider: true,
    } as ListCellProps;
  });

  const computedPercent =
    typeof progressPercentage === "number"
      ? progressPercentage
      : computeTaskProgress({ id: taskId, scheduledSessions, subtasks }, completedParts);
  const progressValue =
    typeof computedPercent === "number" ? Math.max(0, Math.min(1, computedPercent / 100)) : undefined;

  return (
    <View style={styles.section}>
      {!hideTitle ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {typeof progressValue === "number" ? (
            <ProgressIcon value={progressValue} size={ICON_SIZES.md} />
          ) : (
            <View style={{ width: ICON_SIZES.md }} />
          )}
          <AppText>
            <AppText variant="title3" style={styles.sectionTitle}>
              {"Scheduled Sessions "}
            </AppText>
            <AppText variant="notes">{/* duration */}</AppText>
          </AppText>
        </View>
      ) : null}

      <List data={items} />
    </View>
  );
};

export default ScheduledSessionsSection;

const styles = StyleSheet.create({
  section: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  sessionHeaderText: {
    color: COLORS.black,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: SPACING.sm,
  },
  sessionDateHeader: {
    color: COLORS.lightGray,
    marginBottom: SPACING.xs,
  },
});

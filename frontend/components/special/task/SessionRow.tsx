import React from "react";
import { View, Pressable } from "react-native";
import AppText from "../../common/AppText";
import { Checkbox } from "../../icons/Checkbox";
import { getTimeParts, getSubtaskIdFromSession, ScheduledSession, Subtask } from "../../widgets/taskHelpers";
import { SessionTime } from "./SessionTime";
import { StyleSheet } from "react-native";
import { ICON_SIZES, SPACING, COLORS } from "../../../theme";

export const SessionRow: React.FC<{
  session: ScheduledSession;
  taskId: string;
  taskTitle: string;
  categoryColor?: string;
  subtasks?: Subtask[];
  sessionIndex: number;
  isDone?: boolean;
  isLoading?: boolean;
  // callback when the checkbox is toggled (no args)
  checkboxOnToggle?: () => void | Promise<void>;
  // callback when the row is pressed
  rowOnPress?: () => void | Promise<void>;
  canToggle?: boolean;
  hideTaskTitle?: boolean;
  showTaskDate?: boolean;
  lightTitle?: boolean;
}> = ({
  session,
  taskId,
  taskTitle,
  categoryColor,
  subtasks,
  sessionIndex,
  isDone = false,
  isLoading = false,
  checkboxOnToggle,
  rowOnPress,
  canToggle = false,
  hideTaskTitle = false,
  showTaskDate = false,
  lightTitle = false,
}) => {
  const checkboxHandler = checkboxOnToggle ?? rowOnPress ?? undefined;
  const rowPressHandler = rowOnPress ?? (canToggle ? (checkboxOnToggle ?? undefined) : undefined);

  const onCheckboxPress = async () => {
    if (isLoading) return;
    const subtaskId = getSubtaskIdFromSession(session, subtasks);
    const status = !isDone ? "done" : "todo";
    console.debug("[SessionRow] sending fields to server", { taskId, subtaskId, sessionId: session.id, status });
    await checkboxHandler?.();
  };

  const startParts = getTimeParts(session.start);
  const subtaskTitle = session.subtaskTitle || `Part ${session.subtaskIndex ?? sessionIndex + 1}`;

  // Avoid making the row a Pressable when it contains interactive children (checkbox)
  const Container: any = rowPressHandler && !canToggle ? Pressable : View;
  return (
    <View style={styles.sessionRoot}>
      {showTaskDate && (
        <AppText variant="notes" style={[styles.sessionDateText, { color: categoryColor || COLORS.primary1 }]}>
          {session.start ? startParts.date : "Date"}
        </AppText>
      )}
      <Container
        onPress={rowPressHandler && !isLoading ? rowPressHandler : undefined}
        accessibilityRole={rowPressHandler && !canToggle ? "button" : undefined}
        accessibilityState={rowPressHandler && !canToggle ? { disabled: !canToggle, busy: isLoading } : undefined}
        style={styles.sessionRow}
      >
        <SessionTime timeStart={session.start} timeEnd={session.end} categoryColor={categoryColor} />

        <View style={styles.sessionCheckbox}>
          {canToggle ? (
            <Checkbox checked={isDone} onChange={onCheckboxPress} size={ICON_SIZES.sm} />
          ) : (
            <View style={styles.checkboxSpacer} />
          )}
        </View>
        <View style={styles.sessionTitleRow}>
          <AppText variant="bodyText" style={[styles.sessionLabel, isDone && styles.sessionLabelDone]}>
            <AppText variant={lightTitle ? "notes" : "boldText"} style={styles.sessionSubtask}>
              {subtaskTitle}
            </AppText>
            {!hideTaskTitle && taskTitle ? (
              <AppText variant="bodyText" style={styles.sessionTask}>
                {" - " + taskTitle}
              </AppText>
            ) : null}
          </AppText>
        </View>
      </Container>
    </View>
  );
};

export default SessionRow;

const styles = StyleSheet.create({
  sessionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    paddingVertical: 4,
    alignSelf: "stretch",
    width: "100%",
    minHeight: 2 * SPACING.xlg,
    marginBottom: -SPACING.sm,
  },
  sessionRoot: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
    width: "100%",
  },
  sessionDateText: {
    fontWeight: "600",
    marginBottom: SPACING.xs,
  },
  sessionCheckbox: {
    width: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: SPACING.xs,
  },
  checkboxSpacer: {
    width: ICON_SIZES.sm,
    height: ICON_SIZES.sm,
  },
  sessionInfo: {
    gap: SPACING.xs,
  },
  sessionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    flex: 1,
    minWidth: 0,
  },
  sessionLabel: {
    flex: 1,
    flexWrap: "wrap",
  },
  sessionLabelDone: {
    textDecorationLine: "line-through",
  },
  sessionSubtask: {
    fontWeight: "600",
    flexShrink: 1,
  },
  sessionTask: {
    color: COLORS.black,
    flexShrink: 1,
  },
});

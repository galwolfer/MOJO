import React from "react";
import { View, Pressable } from "react-native";
import AppText from "../../common/AppText";
import { Checkbox } from "../../icons/Checkbox";
import { getTimeParts } from "../../widgets/widgetHelpers";
import { StyleSheet } from "react-native";
import { ICON_SIZES, SPACING, COLORS } from "../../../theme";

import { ScheduledSession, Subtask } from "../../widgets/widgetHelpers";

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
}) => {
  const checkboxHandler = checkboxOnToggle ?? rowOnPress ?? undefined;
  const rowPressHandler = rowOnPress ?? (canToggle ? (checkboxOnToggle ?? undefined) : undefined);
  const startParts = getTimeParts(session.start);
  const endParts = getTimeParts(session.end);
  const subtaskTitle = session.subtaskTitle || `Part ${session.subtaskIndex ?? sessionIndex + 1}`;

  const Container: any = rowPressHandler ? Pressable : View;
  return (
    <View>
      {showTaskDate && (
        <AppText variant="notes" style={[styles.sessionDateText, { color: categoryColor || COLORS.primary1 }]}>
          {session.start ? startParts.date : "Date"}
        </AppText>
      )}
      <Container
        onPress={rowPressHandler && !isLoading ? rowPressHandler : undefined}
        accessibilityRole={rowPressHandler ? "button" : undefined}
        accessibilityState={rowPressHandler ? { disabled: !canToggle, busy: isLoading } : undefined}
        style={styles.sessionRow}
      >
        <View style={styles.sessionTimeBlock}>
          <View style={[styles.sessionTimeLine, { backgroundColor: categoryColor || COLORS.primary1 }]} />
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
            <Checkbox checked={isDone} onChange={() => checkboxHandler?.()} size={ICON_SIZES.sm} />
          ) : (
            <View style={styles.checkboxSpacer} />
          )}
        </View>

        <View style={styles.sessionInfo}>
          <View style={styles.sessionTitleRow}>
            <AppText variant="bodyText" style={[styles.sessionTitleText, isDone && styles.sessionLabelDone]}>
              <AppText variant="boldText" style={styles.sessionSubtask}>
                {subtaskTitle}
              </AppText>
              {!hideTaskTitle && taskTitle ? (
                <AppText variant="bodyText" style={styles.sessionTask}>
                  {" - " + taskTitle}
                </AppText>
              ) : null}
            </AppText>
          </View>
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
    width: "100%",
    height: 2 * SPACING.xlg,
    marginBottom: -SPACING.sm,
  },
  sessionDateText: {
    fontWeight: "600",
    marginBottom: SPACING.xs,
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
    flex: 1,
    gap: SPACING.xs,
  },
  sessionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: SPACING.xs,
  },
  sessionLabelDone: {
    textDecorationLine: "line-through",
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
});

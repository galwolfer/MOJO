/**
 * CompletionItem
 *
 * Single component for completable items — a scheduled session (with dual
 * timestamps) or a subtask (with optional time range).
 *
 * ```tsx
 * <CompletionItem type="session" session={s} taskId={id} taskTitle="Work" sessionIndex={0} />
 * <CompletionItem type="subtask" subtask={st} parentTaskId={id} />
 * ```
 */
import React, { useCallback } from "react";
import { View, Pressable, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import AppText from "../../common/AppText";
import TimeDisplay from "../../common/TimeDisplay";
import { Checkbox } from "../../icons/Checkbox";
import { ICONS } from "../../icons/icons";
import { COLORS, SPACING, FONT_SIZES, FONTS, ICON_SIZES } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import { getTimeParts, getSubtaskIdFromSession, ScheduledSession, Subtask } from "../../widgets/taskHelpers";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionProps {
  type: "session";
  session: ScheduledSession;
  taskId: string;
  taskTitle: string;
  sessionIndex: number;
  subtasks?: Subtask[];
  isDone?: boolean;
  isLoading?: boolean;
  categoryColor?: string;
  canToggle?: boolean;
  hideTaskTitle?: boolean;
  showTaskDate?: boolean;
  lightTitle?: boolean;
  checkboxOnToggle?: () => void | Promise<void>;
  rowOnPress?: () => void | Promise<void>;
  showEditIcon?: boolean;
  editOnPress?: () => void;
}

interface SubtaskProps {
  type: "subtask";
  subtask: Subtask;
  parentTaskId: string;
  isCompleted?: boolean;
  isLoading?: boolean;
  categoryColor?: string;
  showTime?: boolean;
  timeRangeElement?: React.ReactNode;
  showEditIcon?: boolean;
  editOnPress?: () => void;
}

export type CompletionItemType = "session" | "subtask";

export type CompletionItemProps = (SessionProps | SubtaskProps) & {
  onToggle?: (parentTaskId: string, subId: string, checked: boolean) => void;
  onDelete?: (parentTaskId: string, subId: string) => void;
};

export const CompletionItem: React.FC<CompletionItemProps> = (props) => {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const { onToggle } = props;
  const isSession = props.type === "session";

  // Narrow to each variant — all hooks must stay unconditional.
  const sp = isSession ? (props as SessionProps) : null;
  const tp = isSession ? null : (props as SubtaskProps);

  const isLoading = props.isLoading ?? false;
  const accentColor = props.categoryColor ?? COLORS.primary1;

  // Session-derived
  const checkboxHandler = sp?.checkboxOnToggle ?? sp?.rowOnPress;
  const rowPressHandler = sp?.rowOnPress ?? (sp?.canToggle ? sp?.checkboxOnToggle : undefined);
  const isDone = sp?.isDone ?? false;
  const label = sp ? (sp.session.subtaskTitle ?? `Part ${sp.session.subtaskIndex ?? sp.sessionIndex + 1}`) : "";
  const sessionDate = sp?.session.start ? getTimeParts(sp.session.start).date : "Date";

  // Subtask-derived
  const isCompleted = tp?.isCompleted ?? false;

  const onCheckboxPress = useCallback(async () => {
    if (!sp || isLoading) return;
    const subtaskId = getSubtaskIdFromSession(sp.session, sp.subtasks);
    console.debug("[CompletionItem] toggle session", { taskId: sp.taskId, subtaskId, sessionId: sp.session.id });
    await checkboxHandler?.();
  }, [sp, isLoading, checkboxHandler]);

  const handleSubtaskPress = useCallback(() => {
    if (tp && onToggle && tp.subtask.id) onToggle(tp.parentTaskId, tp.subtask.id, !isCompleted);
  }, [tp, onToggle, isCompleted]);

  // ── Session ────────────────────────────────────────────────────────────────
  if (sp) {
    const canToggle = sp.canToggle ?? false;
    const RowContainer: any = rowPressHandler && !canToggle ? Pressable : View;

    return (
      <View style={styles.root}>
        {sp.showTaskDate && (
          <AppText variant="notes" style={[styles.dateText, { color: accentColor }]}>
            {sessionDate}
          </AppText>
        )}
        <RowContainer
          style={styles.sessionRow}
          onPress={rowPressHandler && !isLoading ? rowPressHandler : undefined}
          accessibilityRole={rowPressHandler && !canToggle ? "button" : undefined}
          accessibilityState={rowPressHandler && !canToggle ? { disabled: !canToggle, busy: isLoading } : undefined}
        >
          <View style={styles.timeBlock}>
            <View style={[styles.accentLine, { backgroundColor: accentColor }]} />
            <View style={styles.timeColumn}>
              <TimeDisplay isoString={sp.session.start} />
              {sp.session.end ? <TimeDisplay isoString={sp.session.end} /> : null}
            </View>
          </View>

          <View style={styles.checkboxSlot}>
            {canToggle ? (
              <Checkbox checked={isDone} onChange={onCheckboxPress} size={ICON_SIZES.sm} />
            ) : (
              <View style={styles.checkboxSpacer} />
            )}
          </View>

          <View style={styles.titleSlot}>
            <AppText variant="bodyText" style={[styles.labelText, isDone && styles.done]}>
              <AppText
                variant={sp.lightTitle ? "notes" : "boldText"}
                style={[styles.primaryLabel, isDone && styles.done]}
              >
                {label}
              </AppText>
              {!sp.hideTaskTitle && sp.taskTitle ? (
                <AppText variant="bodyText" style={[styles.secondaryLabel, { color: colors.text1 }]}>
                  {" - " + sp.taskTitle}
                </AppText>
              ) : null}
            </AppText>
          </View>
          {sp.showEditIcon && sp.editOnPress && (
            <Pressable style={styles.editSlot} onPress={sp.editOnPress}>
              {ICONS.edit ? React.createElement(ICONS.edit, { size: ICON_SIZES.xs, color: accentColor }) : null}
            </Pressable>
          )}
        </RowContainer>
      </View>
    );
  }

  // ── Subtask ────────────────────────────────────────────────────────────────
  const showTimeRange = (tp!.showTime ?? true) && !!(tp!.timeRangeElement || tp!.subtask.timeRange);

  return (
    <TouchableOpacity style={styles.subtaskContainer} onPress={handleSubtaskPress} activeOpacity={0.6}>
      <View style={styles.subtaskRow}>
        <View pointerEvents="none">
          <Checkbox checked={isCompleted} onChange={() => {}} size={ICON_SIZES.sm} />
        </View>
        <View style={styles.subtaskContent}>
          <AppText variant="notes" style={[styles.subtaskLabel, isCompleted && styles.done, { color: colors.text1 }]}>
            {tp!.subtask.title}
          </AppText>
          {showTimeRange && (
            <View style={styles.timeRangeRow}>
              {tp!.timeRangeElement ?? (
                <AppText style={[styles.timeRangeText, isCompleted && styles.timeRangeDone]}>
                  {tp!.subtask.timeRange}
                </AppText>
              )}
              {width >= 850 && (
                <ICONS.clock
                  size={ICON_SIZES.xs}
                  color={isCompleted ? COLORS.lightGray : (props.categoryColor ?? COLORS.darkGray)}
                />
              )}
            </View>
          )}
        </View>
        {tp!.showEditIcon && tp!.editOnPress && (
          <Pressable style={styles.editSlot} onPress={tp!.editOnPress}>
            {ICONS.edit ? React.createElement(ICONS.edit, { size: ICON_SIZES.sm, color: colors.text1 }) : null}
          </Pressable>
        )}
      </View>
      {tp!.subtask.description && (
        <AppText style={[styles.description, { color: colors.gray2 }]}>{tp!.subtask.description}</AppText>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Shared
  root: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
    width: "100%",
  },
  accentLine: {
    width: SPACING.xs,
    alignSelf: "stretch",
    borderRadius: 999,
  },
  checkboxSlot: {
    width: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: SPACING.xs,
  },
  checkboxSpacer: {
    width: ICON_SIZES.sm,
    height: ICON_SIZES.sm,
  },
  titleSlot: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },

  // Session
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: 4,
    width: "100%",
    minHeight: 2 * SPACING.xlg,
    marginBottom: -SPACING.sm,
  },
  dateText: {
    fontWeight: "600",
    marginBottom: SPACING.xs,
  },
  timeBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  timeColumn: {
    alignItems: "flex-end",
    gap: SPACING.xs,
  },
  labelText: {
    flex: 1,
    flexWrap: "wrap",
    textAlign: "left",
  },
  primaryLabel: {
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "left",
  },
  secondaryLabel: {
    flexShrink: 1,
    textAlign: "left",
  },

  // Subtask
  subtaskContainer: {
    gap: SPACING.xs,
    width: "100%",
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    width: "100%",
  },
  subtaskContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subtaskLabel: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    textAlign: "left",
    flexShrink: 1,
  },
  timeRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  timeRangeText: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
  },
  timeRangeDone: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  description: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    marginLeft: SPACING.xlg,
    lineHeight: Math.round(FONT_SIZES.sm * 1.2),
  },
  editSlot: {
    width: SPACING.lg,
    height: SPACING.lg,
    justifyContent: "center",
    alignItems: "center",
  },

  // Shared text states
  done: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
});

export default CompletionItem;

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  StatusBar,
  SafeAreaView,
  Pressable,
} from "react-native";
import { useTaskContext } from "../context/TaskContext";
import { useColors } from "../context/ThemeContext";
import AppText from "../components/common/AppText";
import AppButton from "../components/common/AppButton";
import PopupBox from "../components/common/PopupBox";
import Box from "../components/layout/Box";
import CalendarPicker from "../components/inputs/CalendarPicker";
import Icon from "../components/icons/Icon";
import { ProgressIcon } from "../components/icons/ProgressIcon.native";
import List, { ListCellProps } from "../components/layout/List";
import { COLORS, SPACING, FONT_SIZES, ICON_SIZES } from "../theme";
import { getCategoryMeta } from "../config/categoryMeta";
import {
  getOverdueTasks,
  getTaskById,
  extendTaskDeadline,
  completeTask,
  declineOverdueTasks,
  Task,
  TaskWithSubtasks,
} from "../services/taskService";
import TaskDetailModal from "./calendar/components/TaskDetailModal";

// Extends the base Task type with fields added by the overdue endpoint
type OverdueTask = Task & {
  daysOverdue?: number;
  tags?: string[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "No deadline";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface OverdueTasksModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function OverdueTasksModal({ visible, onClose }: OverdueTasksModalProps) {
  const { notifyTaskUpdate } = useTaskContext();

  const [tasks, setTasks] = useState<OverdueTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [expandedCalendarId, setExpandedCalendarId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const [successPopup, setSuccessPopup] = useState<{
    title: string;
    body: string;
    color: string;
    taskId: string;
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState("");

  const [detailTask, setDetailTask] = useState<TaskWithSubtasks | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const handleOpenDetail = useCallback(async (taskId: string) => {
    const task = await getTaskById(taskId);
    if (task) {
      setDetailTask(task as TaskWithSubtasks);
      setDetailVisible(true);
    }
  }, []);

  // Load overdue tasks when modal becomes visible
  useEffect(() => {
    if (!visible) return;
    setIsLoading(true);
    getOverdueTasks().then((result) => {
      setTasks(result as OverdueTask[]);
      setIsLoading(false);
    });
  }, [visible]);

  // Auto-close when all tasks are resolved
  useEffect(() => {
    if (!isLoading && tasks.length === 0 && visible) {
      const timer = setTimeout(() => onClose(), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, tasks.length, visible]);

  // ── Remove task from list ──────────────────────────────────────────────────

  const removeTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
  }, []);

  // ── Complete ───────────────────────────────────────────────────────────────

  const handleMarkComplete = useCallback(
    async (task: OverdueTask) => {
      setActionInProgress(task._id);
      const result = await completeTask(task._id);
      setActionInProgress(null);

      if (result) {
        setSuccessPopup({
          title: "Task Completed",
          body: `Great work! "${task.taskname}" has been marked as completed.`,
          color: COLORS.primary6,
          taskId: task._id,
        });
        removeTask(task._id);
      } else {
        setErrorMsg("Failed to mark task as completed. Please try again.");
      }
    },
    [removeTask],
  );

  // ── Extend ─────────────────────────────────────────────────────────────────

  const toggleCalendar = useCallback(
    (taskId: string) => {
      if (expandedCalendarId === taskId) {
        setExpandedCalendarId(null);
        setSelectedDate("");
      } else {
        setExpandedCalendarId(taskId);
        setSelectedDate("");
      }
    },
    [expandedCalendarId],
  );

  const confirmExtend = useCallback(
    async (task: OverdueTask) => {
      if (!selectedDate) {
        setErrorMsg("Please select a new deadline date first.");
        return;
      }
      const d = new Date(selectedDate);
      d.setHours(23, 59, 0, 0);
      const isoDeadline = d.toISOString();

      setActionInProgress(task._id);
      const ok = await extendTaskDeadline(task._id, isoDeadline);
      setActionInProgress(null);

      if (ok) {
        setExpandedCalendarId(null);
        setSelectedDate("");
        setSuccessPopup({
          title: "Deadline Extended",
          body: `"${task.taskname}" has a new deadline: ${selectedDate}. The task is back in your schedule.`,
          color: COLORS.primary1,
          taskId: task._id,
        });
        removeTask(task._id);
      } else {
        setErrorMsg("Failed to extend deadline. Please try again.");
      }
    },
    [selectedDate, removeTask],
  );

  // ── Decline ────────────────────────────────────────────────────────────────

  const handleDeclineTask = useCallback(
    async (task: OverdueTask) => {
      setActionInProgress(task._id);
      await declineOverdueTasks([task._id]);
      setActionInProgress(null);
      removeTask(task._id);
    },
    [removeTask],
  );

  // ── Success popup ──────────────────────────────────────────────────────────

  const dismissSuccess = useCallback(() => {
    setSuccessPopup(null);
    notifyTaskUpdate(successPopup ? { taskId: successPopup.taskId } : undefined);
  }, [successPopup, notifyTaskUpdate]);

  // ── Build list cells from tasks ──────────────────────────────────────────
  const colors = useColors();

  const buildTaskListCell = (task: OverdueTask): ListCellProps => {
    const categoryMeta = getCategoryMeta(task.category);
    const subCat = task.subCategory;
    const subIcon = subCat?.icon;
    const progress =
      typeof task.progressPercentage === "number" ? Math.max(0, Math.min(1, task.progressPercentage / 100)) : 0;

    return {
      id: task._id,
      content: (
        <View>
          {/* Task info row — tappable to open detail modal */}
          <Pressable onPress={() => handleOpenDetail(task._id)} style={[overdueListStyles.taskRow]}>
            <View style={overdueListStyles.taskContent}>
              <ProgressIcon value={progress} size={ICON_SIZES.sm} />
              <AppText variant="bodyText" numberOfLines={1} style={overdueListStyles.taskName}>
                {task.taskname || (task as any).title || "Untitled"}
              </AppText>
            </View>
            <View style={overdueListStyles.taskIcons}>
              {subIcon && subIcon !== categoryMeta.icon ? (
                <Icon name={subIcon} size={ICON_SIZES.xs} color={colors.gray1} />
              ) : null}
              <Icon name={categoryMeta.icon as string} size={ICON_SIZES.sm} color={categoryMeta.color} />
            </View>
          </Pressable>

          {/* Action buttons */}
          <View style={overdueListStyles.taskActionSection}>
            <AppButton
              title={actionInProgress === task._id ? "Working…" : "Completed"}
              mode="filled"
              color={colors.primary6}
              icon="check"
              iconPosition="left"
              onPress={() => handleMarkComplete(task)}
              disabled={actionInProgress === task._id}
              style={overdueListStyles.taskActionBtn}
            />
            <AppButton
              title={expandedCalendarId === task._id ? "Cancel" : "Extend"}
              mode="light"
              color={colors.primary1}
              icon="calendar"
              iconPosition="left"
              onPress={() => toggleCalendar(task._id)}
              disabled={actionInProgress === task._id}
              style={overdueListStyles.taskActionBtn}
            />
            <AppButton
              title="Decline"
              mode="light"
              color={colors.text2}
              onPress={() => handleDeclineTask(task)}
              disabled={actionInProgress === task._id}
              style={overdueListStyles.taskActionBtn}
            />
          </View>

          {/* Inline calendar picker */}
          {expandedCalendarId === task._id && (
            <View style={[overdueListStyles.calendarSection, { borderTopColor: colors.divider }]}>
              <CalendarPicker selectedDate={selectedDate} onDateSelect={setSelectedDate} allowPastDates={false} />
              {selectedDate ? (
                <AppButton
                  title={actionInProgress === task._id ? "Extending…" : `Confirm – ${selectedDate}`}
                  mode="filled"
                  color={colors.primary1}
                  onPress={() => confirmExtend(task)}
                  disabled={actionInProgress === task._id}
                  style={overdueListStyles.taskActionBtn}
                />
              ) : null}
            </View>
          )}
        </View>
      ),
    };
  };

  // ── Task detail modal open/close ───────────────────────────────────────────

  // ── Render ─────────────────────────────────────────────────────────────────

  const dynamicStyles = getOverdueStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {}}>
      <StatusBar barStyle="dark-content" />
      <Pressable style={dynamicStyles.overlay} onPress={() => null}>
        <Pressable onPress={(e) => e.stopPropagation()} style={dynamicStyles.sheetContainer}>
          <SafeAreaView style={dynamicStyles.sheet}>
            <Box
              title="Overdue Tasks"
              titleColor={colors.primary7}
              titleIcon={<Icon name="clock" size={22} color={colors.primary7} />}
            >
              {/* Subtitle */}
              <AppText variant="notes" style={dynamicStyles.subtitle}>
                {isLoading
                  ? "Checking for overdue tasks…"
                  : tasks.length === 1
                    ? "You have 1 overdue task. Handle it to continue."
                    : tasks.length > 1
                      ? `You have ${tasks.length} overdue tasks. Handle them to continue.`
                      : "All caught up!"}
              </AppText>

              {/* Content */}
              {isLoading ? (
                <View style={dynamicStyles.centered}>
                  <ActivityIndicator size="large" color={colors.primary1} />
                </View>
              ) : tasks.length > 0 ? (
                <List data={tasks.map((task) => buildTaskListCell(task))} />
              ) : (
                <View style={dynamicStyles.emptyState}>
                  <Icon name="check" size={40} color={colors.primary6} />
                  <AppText variant="boldText" style={dynamicStyles.emptyText}>
                    All done!
                  </AppText>
                </View>
              )}
            </Box>
          </SafeAreaView>
        </Pressable>
      </Pressable>

      {/* Success popup */}
      <PopupBox
        visible={successPopup !== null}
        onClose={dismissSuccess}
        title={successPopup?.title ?? ""}
        titleColor={successPopup?.color ?? colors.primary6}
      >
        <AppText variant="bodyText" style={dynamicStyles.popupBody}>
          {successPopup?.body ?? ""}
        </AppText>
        <AppButton
          title="Got it"
          mode="filled"
          color={successPopup?.color ?? colors.primary6}
          onPress={dismissSuccess}
          style={dynamicStyles.popupBtn}
        />
      </PopupBox>

      {/* Error popup */}
      <PopupBox
        visible={errorMsg !== ""}
        onClose={() => setErrorMsg("")}
        title="Something went wrong"
        titleColor={colors.primary7}
      >
        <AppText variant="bodyText" style={dynamicStyles.popupBody}>
          {errorMsg}
        </AppText>
        <AppButton
          title="OK"
          mode="filled"
          color={colors.primary1}
          onPress={() => setErrorMsg("")}
          style={dynamicStyles.popupBtn}
        />
      </PopupBox>

      {/* Task detail modal */}
      <TaskDetailModal visible={detailVisible} task={detailTask} onClose={() => setDetailVisible(false)} />
    </Modal>
  );
}

// Keep a named screen export for backward-compat (index.ts re-exports it)
export { OverdueTasksModal as OverdueTasksScreen };

// ── Styles ─────────────────────────────────────────────────────────────────

const overdueListStyles = StyleSheet.create({
  taskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  taskContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  taskName: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: "600",
  },
  taskIcons: {
    flexDirection: "row",
    gap: SPACING.xs,
    alignItems: "center",
  },
  taskActionSection: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  taskActionBtn: {
    flex: 1,
    paddingHorizontal: SPACING.xs,
  },
  calendarSection: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.xs,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    gap: SPACING.sm,
  },
});

const getOverdueStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    sheetContainer: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.bg1,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: "88%",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 6,
    },
    centered: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: SPACING.xlg,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: SPACING.xlg,
      gap: SPACING.md,
    },
    emptyText: {
      color: colors.primary6,
      fontSize: FONT_SIZES.lg,
    },
    subtitle: {
      color: colors.text2,
      marginBottom: SPACING.md,
      lineHeight: 20,
    },
    listWrapper: {
      flex: 1,
      marginVertical: SPACING.md,
    },
    listContent: {
      paddingBottom: SPACING.md,
    },
    popupBody: {
      color: colors.text2,
      marginBottom: SPACING.lg,
      lineHeight: 22,
    },
    popupBtn: {
      flex: 1,
    },
  });

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.white3,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xlg,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xlg,
    gap: SPACING.md,
  },
  emptyText: {
    color: COLORS.primary6,
    fontSize: FONT_SIZES.lg,
  },
  subtitle: {
    color: COLORS.lightGray,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  listWrapper: {
    flex: 1,
    marginVertical: SPACING.md,
  },
  listContent: {
    paddingBottom: SPACING.md,
  },
  popupBody: {
    color: COLORS.darkGray,
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  popupBtn: {
    flex: 1,
  },
  // Task row styles
  taskRow: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
    paddingVertical: SPACING.md,
  },
  taskActionSection: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  taskActionBtn: {
    flex: 1,
    paddingHorizontal: SPACING.xs,
  },
  calendarSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.white2,
    gap: SPACING.sm,
  },
});

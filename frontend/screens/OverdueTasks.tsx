import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useTaskContext } from "../context/TaskContext";
import AppText from "../components/common/AppText";
import AppButton from "../components/common/AppButton";
import PopupBox from "../components/common/PopupBox";
import CalendarPicker from "../components/inputs/CalendarPicker";
import Icon from "../components/icons/Icon";
import List, { ListCellProps } from "../components/layout/List";
import { COLORS, SPACING, FONT_SIZES, ICON_SIZES } from "../theme";
import { getCategoryMeta } from "../config/categoryMeta";
import {
  getOverdueTasks,
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

  const [selectedTask, setSelectedTask] = useState<OverdueTask | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Load overdue tasks when modal becomes visible
  useEffect(() => {
    if (!visible) return;
    setIsLoading(true);
    getOverdueTasks().then((result) => {
      setTasks(result as OverdueTask[]);
      setIsLoading(false);
    });
  }, [visible]);

  // Auto-close when all tasks are resolved (close immediately)
  useEffect(() => {
    if (!isLoading && tasks.length === 0 && visible) {
      onClose();
    }
  }, [isLoading, tasks.length, visible, onClose]);

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
          body: `Great work! "${task.taskname}" completed.`,
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

  // ── Detail modal ───────────────────────────────────────────────────────────

  const handleTaskPress = useCallback((task: OverdueTask) => {
    setSelectedTask(task);
    setDetailVisible(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailVisible(false);
    setSelectedTask(null);
  }, []);

  // ── Success popup ──────────────────────────────────────────────────────────

  const dismissSuccess = useCallback(() => {
    setSuccessPopup(null);
    notifyTaskUpdate(successPopup ? { taskId: successPopup.taskId } : undefined);
  }, [successPopup, notifyTaskUpdate]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <PopupBox
        visible={visible && (isLoading || tasks.length > 0 || successPopup !== null)}
        onClose={onClose}
        closeOnBackdropPress={false}
        title="Overdue Tasks"
        titleColor={COLORS.primary7}
        titleIcon={<Icon name="strictojo" size={ICON_SIZES.md} color={COLORS.white} />}
      >
        <AppText variant="notes" style={styles.subtitle}>
          {isLoading
            ? "Checking for overdue tasks…"
            : tasks.length === 1
              ? "You have 1 overdue task. Handle it to continue."
              : tasks.length > 1
                ? `You have ${tasks.length} overdue tasks. Handle them to continue.`
                : ""}
        </AppText>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary1} />
          </View>
        ) : tasks.length > 0 ? (
          <List
            data={tasks.map((task) => ({
              id: task._id,
              onPress: () => handleTaskPress(task),
              content: (
                <View>
                  <View style={styles.taskHeader}>
                    <Icon
                      name={getCategoryMeta(task.category).icon as string}
                      size={20}
                      color={getCategoryMeta(task.category).color}
                    />
                    <AppText variant="boldText" numberOfLines={1} style={styles.taskName}>
                      {task.taskname || "Untitled"}
                    </AppText>
                  </View>

                  <View style={styles.taskActionSection}>
                    <AppButton
                      title={actionInProgress === task._id ? "Working…" : "Complete"}
                      mode="filled"
                      color={COLORS.primary6}
                      iconPosition="left"
                      onPress={() => handleMarkComplete(task)}
                      disabled={actionInProgress === task._id}
                      style={styles.taskActionBtn}
                    />
                    <AppButton
                      title={expandedCalendarId === task._id ? "Cancel" : "Extend"}
                      mode="light"
                      color={COLORS.primary1}
                      iconPosition="left"
                      onPress={() => toggleCalendar(task._id)}
                      disabled={actionInProgress === task._id}
                      style={styles.taskActionBtn}
                    />
                    <AppButton
                      title="Decline"
                      mode="light"
                      color={COLORS.lightGray}
                      onPress={() => handleDeclineTask(task)}
                      disabled={actionInProgress === task._id}
                      style={styles.taskActionBtn}
                    />
                  </View>

                  {expandedCalendarId === task._id && (
                    <View style={styles.calendarSection}>
                      <CalendarPicker
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                        allowPastDates={false}
                      />
                      {selectedDate && (
                        <AppButton
                          title={actionInProgress === task._id ? "Extending…" : `Confirm – ${selectedDate}`}
                          mode="filled"
                          color={COLORS.primary1}
                          onPress={() => confirmExtend(task)}
                          disabled={actionInProgress === task._id}
                          style={styles.taskActionBtn}
                        />
                      )}
                    </View>
                  )}
                </View>
              ),
              divider: true,
            }))}
            gap={0}
            dividerColor={COLORS.white2}
          />
        ) : null}
      </PopupBox>

      {/* Success popup */}
      <PopupBox
        visible={successPopup !== null}
        onClose={dismissSuccess}
        title={successPopup?.title ?? ""}
        titleColor={successPopup?.color ?? COLORS.primary6}
      >
        <AppText variant="bodyText" style={styles.popupBody}>
          {successPopup?.body ?? ""}
        </AppText>
      </PopupBox>

      {/* Error popup */}
      <PopupBox
        visible={errorMsg !== ""}
        onClose={() => setErrorMsg("")}
        title="Something went wrong"
        titleColor={COLORS.primary7}
      >
        <AppText variant="bodyText" style={styles.popupBody}>
          {errorMsg}
        </AppText>
        <AppButton
          title="OK"
          mode="filled"
          color={COLORS.primary1}
          onPress={() => setErrorMsg("")}
          style={styles.popupBtn}
        />
      </PopupBox>

      {/* Task detail modal */}
      <TaskDetailModal visible={detailVisible} task={selectedTask} onClose={handleCloseDetail} />
    </>
  );
}

// Keep a named screen export for backward-compat (index.ts re-exports it)
export { OverdueTasksModal as OverdueTasksScreen };

const styles = StyleSheet.create({
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
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  taskName: {
    flex: 1,
    fontSize: FONT_SIZES.md,
  },
  popupBody: {
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  popupBtn: {
    flex: 1,
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

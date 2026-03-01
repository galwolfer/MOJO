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
import AppText from "../components/common/AppText";
import AppButton from "../components/common/AppButton";
import PopupBox from "../components/common/PopupBox";
import Box from "../components/layout/Box";
import CalendarPicker from "../components/inputs/CalendarPicker";
import Icon from "../components/icons/Icon";
import { COLORS, SPACING, FONT_SIZES } from "../theme";
import { getCategoryMeta } from "../config/categoryMeta";
import TaskListItem from "./calendar/components/TaskListItem";
import { getOverdueTasks, extendTaskDeadline, completeTask, declineOverdueTasks, Task } from "../services/taskService";

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {}}>
      <StatusBar barStyle="dark-content" />
      <Pressable style={styles.overlay} onPress={() => null}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.sheetContainer}>
          <SafeAreaView style={styles.sheet}>
            <Box
              title="Overdue Tasks"
              titleColor={COLORS.primary7}
              titleIcon={<Icon name="clock" size={22} color={COLORS.primary7} />}
            >
              {/* Subtitle */}
              <AppText variant="notes" style={styles.subtitle}>
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
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={COLORS.primary1} />
                </View>
              ) : tasks.length > 0 ? (
                <ScrollView
                  style={styles.listWrapper}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                >
                  {tasks.map((task) => (
                    <View key={task._id} style={styles.taskRow}>
                      <TaskListItem
                        task={task}
                        onPress={() => {}} // No-op since buttons are shown directly
                      />

                      {/* Action buttons directly under task */}
                      <View style={styles.taskActionSection}>
                        <AppButton
                          title={actionInProgress === task._id ? "Working…" : "Completed"}
                          mode="filled"
                          color={COLORS.primary6}
                          icon="check"
                          iconPosition="left"
                          onPress={() => handleMarkComplete(task)}
                          disabled={actionInProgress === task._id}
                          style={styles.taskActionBtn}
                        />
                        <AppButton
                          title={expandedCalendarId === task._id ? "Cancel" : "Extend"}
                          mode="light"
                          color={COLORS.primary1}
                          icon="calendar"
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

                      {/* Inline calendar picker */}
                      {expandedCalendarId === task._id && (
                        <View style={styles.calendarSection}>
                          <CalendarPicker
                            selectedDate={selectedDate}
                            onDateSelect={setSelectedDate}
                            allowPastDates={false}
                          />
                          {selectedDate ? (
                            <AppButton
                              title={actionInProgress === task._id ? "Extending…" : `Confirm – ${selectedDate}`}
                              mode="filled"
                              color={COLORS.primary1}
                              onPress={() => confirmExtend(task)}
                              disabled={actionInProgress === task._id}
                              style={styles.taskActionBtn}
                            />
                          ) : null}
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.emptyState}>
                  <Icon name="check" size={40} color={COLORS.primary6} />
                  <AppText variant="boldText" style={styles.emptyText}>
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
        titleColor={successPopup?.color ?? COLORS.primary6}
      >
        <AppText variant="bodyText" style={styles.popupBody}>
          {successPopup?.body ?? ""}
        </AppText>
        <AppButton
          title="Got it"
          mode="filled"
          color={successPopup?.color ?? COLORS.primary6}
          onPress={dismissSuccess}
          style={styles.popupBtn}
        />
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
    </Modal>
  );
}

// Keep a named screen export for backward-compat (index.ts re-exports it)
export { OverdueTasksModal as OverdueTasksScreen };

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

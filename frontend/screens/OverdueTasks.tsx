/**
 * OverdueTasks Screen
 *
 * Blocking screen shown on app launch when the user has tasks whose dueDate
 * has passed and that are not yet completed. The user must handle every
 * overdue task — either extend the deadline or forfeit the task — before
 * continuing to the rest of the app.
 *
 * Actions available per task:
 *  • Mark as completed → POST /tasks/:id/complete
 *  • Extend deadline   → picks a new date via CalendarPicker → PATCH /tasks/expired/:id/extend
 *  • Forfeit           → confirmation popup              → DELETE /tasks/expired/:id/forfeit
 *
 * When the list is empty the screen automatically navigates to "chat".
 */

import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { useNavigation } from "../context/NavigationContext";
import { useLayout } from "../context/LayoutContext";
import { useTaskContext } from "../context/TaskContext";
import AppText from "../components/common/AppText";
import AppButton from "../components/common/AppButton";
import PopupBox from "../components/common/PopupBox";
import CalendarPicker from "../components/inputs/CalendarPicker";
import Icon from "../components/icons/Icon";
import { COLORS, SPACING, FONT_SIZES } from "../theme";
import { getCategoryMeta } from "../config/categoryMeta";
import {
  getOverdueTasks,
  extendTaskDeadline,
  forfeitTask,
  completeTask,
  Task,
} from "../services/taskService";

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

// ─── OverdueTaskCard ─────────────────────────────────────────────────────────

type OverdueTaskCardProps = {
  task: Task;
  isCompletingThis: boolean;
  isCalendarOpen: boolean;
  selectedDate: string;
  isExtending: boolean;
  onMarkComplete: () => void;
  onToggleCalendar: () => void;
  onDateSelect: (date: string) => void;
  onConfirmExtend: () => void;
  onForfeit: () => void;
};

function OverdueTaskCard({
  task,
  isCompletingThis,
  isCalendarOpen,
  selectedDate,
  isExtending,
  onMarkComplete,
  onToggleCalendar,
  onDateSelect,
  onConfirmExtend,
  onForfeit,
}: OverdueTaskCardProps) {
  const catMeta = getCategoryMeta(task.category);
  const isDisabled = isCompletingThis;

  return (
    <View style={[cardStyles.card, { borderLeftColor: catMeta.color }]}>
      {/* Category + Title */}
      <View style={cardStyles.cardTop}>
        <View style={[cardStyles.categoryBadge, { backgroundColor: catMeta.color + "22" }]}>
          <Icon name={catMeta.icon as string} size={20} color={catMeta.color} />
        </View>
        <View style={cardStyles.cardTitleBlock}>
          <AppText variant="boldText" style={cardStyles.taskName} numberOfLines={2}>
            {task.taskname}
          </AppText>
          {catMeta.displayName ? (
            <AppText variant="notes" style={[cardStyles.categoryLabel, { color: catMeta.color }]}>
              {catMeta.displayName}
            </AppText>
          ) : null}
        </View>
      </View>

      {/* Due date */}
      <View style={cardStyles.metaRow}>
        <Icon name="calendar" size={13} color={COLORS.primary7} />
        <AppText variant="notes" style={cardStyles.overdueLabel}>
          Was due: {formatDate(task.dueDate)}
        </AppText>
      </View>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <View style={cardStyles.tagsRow}>
          {task.tags.map((tag) => (
            <View key={tag} style={cardStyles.tag}>
              <AppText variant="notes" style={cardStyles.tagText}>
                {tag}
              </AppText>
            </View>
          ))}
        </View>
      )}

      {/* Mark as Completed */}
      <AppButton
        title={isCompletingThis ? "Completing…" : "Mark as Completed"}
        mode="filled"
        color={COLORS.primary6}
        icon="check"
        iconPosition="left"
        onPress={onMarkComplete}
        disabled={isDisabled}
        style={cardStyles.fullBtn}
      />

      {/* Extend Deadline */}
      <AppButton
        title={isCalendarOpen ? "Cancel Extend" : "Extend Deadline"}
        mode={isCalendarOpen ? "light" : "filled"}
        color={isCalendarOpen ? COLORS.lightGray : COLORS.primary1}
        onPress={onToggleCalendar}
        disabled={isDisabled}
        style={cardStyles.fullBtn}
      />

      {/* Forfeit */}
      <AppButton
        title="Forfeit Task"
        mode="light"
        color={COLORS.primary7}
        onPress={onForfeit}
        disabled={isDisabled}
        style={cardStyles.fullBtn}
      />

      {/* Inline calendar */}
      {isCalendarOpen && (
        <View style={cardStyles.calendarWrap}>
          <CalendarPicker
            onDateSelect={onDateSelect}
            selectedDate={selectedDate}
            allowPastDates={false}
          />
          {selectedDate !== "" && (
            <AppButton
              title={isExtending ? "Saving…" : `Confirm — ${selectedDate}`}
              mode="filled"
              color={COLORS.primary6}
              onPress={onConfirmExtend}
              disabled={isExtending}
              style={cardStyles.fullBtn}
            />
          )}
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: 16,
    borderLeftWidth: 4,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    gap: SPACING.sm,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  categoryBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTitleBlock: {
    flex: 1,
    gap: 2,
  },
  taskName: {
    fontSize: FONT_SIZES.md,
    color: COLORS.darkGray,
  },
  categoryLabel: {
    fontSize: FONT_SIZES.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  overdueLabel: {
    color: COLORS.primary7,
    fontSize: FONT_SIZES.sm,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  tag: {
    backgroundColor: COLORS.white2,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 20,
  },
  tagText: {
    color: COLORS.lightGray,
  },
  fullBtn: {
    alignSelf: "stretch",
  },
  calendarWrap: {
    marginTop: SPACING.xs,
    gap: SPACING.sm,
  },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function OverdueTasksScreen() {
  const { setActiveTab, setHeaderConfig, setNavBarConfig } = useNavigation();
  const { dimensions } = useLayout();
  const { effectiveNavBarHeight } = dimensions;
  const { notifyTaskUpdate } = useTaskContext();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Which task has its inline calendar open
  const [expandedCalendarId, setExpandedCalendarId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isExtending, setIsExtending] = useState(false);

  // Forfeit confirmation popup
  const [forfeitTarget, setForfeitTarget] = useState<Task | null>(null);
  const [isForfeiting, setIsForfeiting] = useState(false);

  // Mark as completed
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Success popup (shown after any action succeeds, task removed when closed)
  const [successPopup, setSuccessPopup] = useState<{
    title: string;
    body: string;
    color: string;
    taskId: string;
  } | null>(null);

  const dismissSuccess = () => {
    if (!successPopup) return;
    const { taskId } = successPopup;
    setSuccessPopup(null);
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
    notifyTaskUpdate({ taskId });
  };

  // Generic error popup
  const [errorMsg, setErrorMsg] = useState("");

  // ── Lifecycle ───────────────────────────────────────────────────────────

  // Hide header & navbar: this is a blocking, full-screen flow
  useEffect(() => {
    setHeaderConfig({ show: false });
    setNavBarConfig({ show: false });
    return () => {
      setHeaderConfig({ show: true, title: "Mojo" });
      setNavBarConfig({ show: true });
    };
  }, []);

  // Load overdue tasks on mount
  useEffect(() => {
    (async () => {
      const result = await getOverdueTasks();
      setTasks(result);
      setIsLoading(false);
    })();
  }, []);

  // Navigate away automatically when there are no overdue tasks left
  useEffect(() => {
    if (!isLoading && tasks.length === 0) {
      const timer = setTimeout(() => setActiveTab("chat"), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, tasks.length]);

  // ── Extend ──────────────────────────────────────────────────────────────

  const toggleCalendar = (task: Task) => {
    if (expandedCalendarId === task._id) {
      setExpandedCalendarId(null);
      setSelectedDate("");
    } else {
      setExpandedCalendarId(task._id);
      setSelectedDate("");
    }
  };

  const confirmExtend = async (task: Task) => {
    if (!selectedDate) {
      setErrorMsg("Please select a new deadline date first.");
      return;
    }
    // Use end-of-selected-day as the new deadline
    const d = new Date(selectedDate);
    d.setHours(23, 59, 0, 0);
    const isoDeadline = d.toISOString();

    setIsExtending(true);
    const ok = await extendTaskDeadline(task._id, isoDeadline);
    setIsExtending(false);

    if (ok) {
      setExpandedCalendarId(null);
      setSelectedDate("");
      setSuccessPopup({
        title: "Deadline Extended",
        body: `"${task.taskname}" has a new deadline: ${selectedDate}. The task is back in your schedule.`,
        color: COLORS.primary1,
        taskId: task._id,
      });
    } else {
      setErrorMsg("Failed to extend deadline. Please try again.");
    }
  };

  // ── Mark as completed ───────────────────────────────────────────────────

  const handleMarkComplete = async (task: Task) => {
    setCompletingId(task._id);
    const result = await completeTask(task._id);
    setCompletingId(null);

    if (result) {
      setExpandedCalendarId(null);
      setSuccessPopup({
        title: "Task Completed",
        body: `Great work! "${task.taskname}" has been marked as completed.`,
        color: COLORS.primary6,
        taskId: task._id,
      });
    } else {
      setErrorMsg("Failed to mark task as completed. Please try again.");
    }
  };

  // ── Forfeit ─────────────────────────────────────────────────────────────

  const confirmForfeit = async () => {
    if (!forfeitTarget) return;
    const taskName = forfeitTarget.taskname;
    const taskId = forfeitTarget._id;
    setIsForfeiting(true);
    const ok = await forfeitTask(taskId);
    setIsForfeiting(false);
    setForfeitTarget(null);

    if (ok) {
      setSuccessPopup({
        title: "Task Forfeited",
        body: `"${taskName}" has been deleted along with all its scheduled sessions.`,
        color: COLORS.darkGray,
        taskId,
      });
    } else {
      setErrorMsg("Failed to forfeit task. Please try again.");
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={COLORS.primary1} />
        <AppText variant="bodyText" style={styles.loadingText}>
          Checking for overdue tasks…
        </AppText>
      </SafeAreaView>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ── Page header ───────────────────────────────────────────────── */}
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderRow}>
          <Icon name="clock" size={26} color={COLORS.primary7} />
          <AppText variant="title2" style={styles.pageTitle}>
            Overdue Tasks
          </AppText>
        </View>
        <AppText variant="notes" style={styles.pageSubtitle}>
          {tasks.length === 1
            ? "You have 1 overdue task. Handle it before continuing."
            : `You have ${tasks.length} overdue tasks. Handle them before continuing.`}
        </AppText>
      </View>

      {/* ── Task list ─────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: effectiveNavBarHeight + SPACING.xlg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {tasks.map((task) => (
          <OverdueTaskCard
            key={task._id}
            task={task}
            isCompletingThis={completingId === task._id}
            isCalendarOpen={expandedCalendarId === task._id}
            selectedDate={expandedCalendarId === task._id ? selectedDate : ""}
            isExtending={isExtending}
            onMarkComplete={() => handleMarkComplete(task)}
            onToggleCalendar={() => toggleCalendar(task)}
            onDateSelect={(d: string) => setSelectedDate(d)}
            onConfirmExtend={() => confirmExtend(task)}
            onForfeit={() => setForfeitTarget(task)}
          />
        ))}
      </ScrollView>

      {/* ── Success popup ─────────────────────────────────────────────────── */}
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

      {/* ── Forfeit confirmation popup ───────────────────────────────────── */}
      <PopupBox
        visible={forfeitTarget !== null}
        onClose={() => {
          if (!isForfeiting) setForfeitTarget(null);
        }}
        title="Forfeit Task?"
        titleColor={COLORS.primary7}
      >
        <AppText variant="bodyText" style={styles.popupBody}>
          Are you sure you want to forfeit{" "}
          <AppText variant="boldText">"{forfeitTarget?.taskname}"</AppText>?
          {"\n\n"}
          This will permanently delete the task and cancel all its scheduled
          sessions. This cannot be undone.
        </AppText>
        <View style={styles.popupBtns}>
          <AppButton
            title="Cancel"
            mode="light"
            color={COLORS.lightGray}
            onPress={() => setForfeitTarget(null)}
            disabled={isForfeiting}
            style={styles.popupBtn}
          />
          <AppButton
            title={isForfeiting ? "Forfeiting…" : "Yes, Forfeit"}
            mode="filled"
            color={COLORS.primary7}
            onPress={confirmForfeit}
            disabled={isForfeiting}
            style={styles.popupBtn}
          />
        </View>
      </PopupBox>

      {/* ── Error popup ─────────────────────────────────────────────────── */}
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
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white3,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.white3,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  loadingText: {
    color: COLORS.lightGray,
    marginTop: SPACING.sm,
  },

  // Page header
  pageHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xlg * 2,
    paddingBottom: SPACING.lg,
  },
  pageHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  pageTitle: {
    color: COLORS.primary7,
  },
  pageSubtitle: {
    color: COLORS.lightGray,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.lg,
  },

  // Popups
  popupBody: {
    color: COLORS.darkGray,
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  popupBtns: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  popupBtn: {
    flex: 1,
  },
});

/**
 * CalendarScreen
 *
 * A professional task management calendar view that displays tasks organized by date.
 * Features:
 * - 7-day horizontal date selector with navigation
 * - Tasks grouped by date in rounded containers
 * - Category icons and color-coded task bars
 * - Subtask support with completion state
 * - Floating action button for quick task creation
 * - Clickable/expandable tasks with detailed view
 *
 * Usage:
 * ```tsx
 * <CalendarScreen />
 * ```
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import { COLORS, SPACING, ICON_SIZES } from "../../theme";
import { useColors } from "../../context/ThemeContext";
import { ICONS } from "../../components/icons/icons";
import { useNavigation } from "../../context/NavigationContext";
import { useTaskContext } from "../../context/TaskContext";
import DateSelector from "../../components/layout/DateSelector";
import CalendarPicker from "../../components/inputs/CalendarPicker";
import ScrollableContent from "../../components/layout/ScrollableContent";
import { getLocalDateString } from "../../utils/dateUtils";
import EmptyState from "./components/EmptyState";
import TaskGroup from "./components/TaskGroup";
import FloatingButton from "../../components/common/FloatingButton";
import { useCalendarTasks } from "./hooks/useCalendarTasks";
import { Task } from "./types";
import { useOptionalStatsContext } from "../../context/StatsContext";
import NotificationBell from "../../components/common/NotificationBell";

export default function CalendarScreen() {
  const { setHeaderConfig, setActiveTab, setActiveTabWithParams, calendarSelectedDate, setCalendarSelectedDate } =
    useNavigation();
  const colors = useColors();
  const { notifyTaskUpdate, subscribeToTaskUpdates } = useTaskContext();
  const { notifyStatsChange } = useOptionalStatsContext();

  // Use context-persisted date so the selection survives tab switches
  const selectedDate = calendarSelectedDate;
  const setSelectedDate = setCalendarSelectedDate;

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showCalendarPicker, setShowCalendarPicker] = useState<boolean>(false);

  useEffect(() => {
    const bottomElement = showCalendarPicker ? (
      <CalendarPicker
        onDateSelect={(dateString) => {
          setSelectedDate(new Date(dateString));
          setShowCalendarPicker(false);
        }}
        selectedDate={getLocalDateString(selectedDate)}
        allowPastDates={true}
        allowPreviousMonths={true}
        lighterPastDates={true}
      />
    ) : (
      <DateSelector selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
    );

    setHeaderConfig({
      show: true,
      title: "MY TASKS",
      leftElement: (
        <TouchableOpacity onPress={() => setShowCalendarPicker((prev) => !prev)} activeOpacity={0.7}>
          <ICONS.calendar size={ICON_SIZES.md} color={colors.primary1} />
        </TouchableOpacity>
      ),
      rightElement: (
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
          <NotificationBell />
          <TouchableOpacity onPress={() => setActiveTab("alltasks")} activeOpacity={0.7}>
            <ICONS.list size={ICON_SIZES.md} color={colors.primary1} />
          </TouchableOpacity>
        </View>
      ),
      element: bottomElement,
    });
  }, [selectedDate, showCalendarPicker]);

  // Use custom hook for task management
  const {
    isLoading,
    error,
    completedTasks,
    completedSubtasks,
    fetchTasksForDate,
    handleTaskCompletionToggle,
    handleSubtaskCompletionToggle,
    handleDeleteTask,
    handleDeleteSubtask,
    getFilteredTaskGroups,
  } = useCalendarTasks(selectedDate, notifyTaskUpdate, subscribeToTaskUpdates, notifyStatsChange);

  const filteredTaskGroups = getFilteredTaskGroups();

  const handleAddTask = useCallback(() => {
    setActiveTab("create");
  }, [setActiveTab]);

  const handleEditTask = useCallback(
    (taskToEdit: Task) => {
      // taskToEdit.id is the session ID; taskToEdit.taskId is the actual task _id
      const actualTaskId = taskToEdit.taskId || taskToEdit.id;
      setActiveTabWithParams("edit" as any, { taskId: actualTaskId });
    },
    [setActiveTabWithParams],
  );

  const handleTaskPress = useCallback((taskId: string) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <ScrollableContent
        respectHeader={true}
        respectNavBar={true}
        extraTopPadding={SPACING.lg}
        scrollKey="calendar"
        contentContainerStyle={styles.contentContainer}
        extraBottomPadding={SPACING.xlg * 3}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary1} />
            <AppText variant="bodyText" style={{ color: colors.gray1 }}>
              Loading tasks...
            </AppText>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <AppText variant="boldText" style={{ color: colors.primary1, textAlign: "center" }}>
              Unable to Load Tasks
            </AppText>
            <AppText variant="bodyText" style={{ color: colors.gray2, textAlign: "center" }}>
              {error}
            </AppText>
            <AppButton
              title="Retry"
              onPress={() => fetchTasksForDate(selectedDate)}
              mode="filled"
              color="primary1" // button component uses dynamic color internally based on theme
              style={styles.retryButton}
            />
          </View>
        ) : filteredTaskGroups.length === 0 ? (
          <EmptyState showCalendarPicker={showCalendarPicker} onAddTask={handleAddTask} />
        ) : (
          filteredTaskGroups.map((group, groupIdx) => (
            <TaskGroup
              key={groupIdx}
              group={group}
              expandedTaskId={expandedTaskId}
              completedTasks={completedTasks}
              completedSubtasks={completedSubtasks}
              onTaskPress={handleTaskPress}
              onTaskToggle={handleTaskCompletionToggle}
              onTaskEdit={handleEditTask}
              onTaskDelete={handleDeleteTask}
              onSubtaskToggle={handleSubtaskCompletionToggle}
              onSubtaskDelete={handleDeleteSubtask}
            />
          ))
        )}
      </ScrollableContent>

      {/* Floating ADD Button - absolute overlay */}
      <FloatingButton onPress={handleAddTask} text="Add Task" Icon={ICONS.plus} />
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    alignItems: "center",
    gap: SPACING.lg,
    paddingBottom: SPACING.xlg * 6,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SPACING.xlg,
    gap: SPACING.md,
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xlg,
    gap: SPACING.md,
  },
  retryButton: {
    alignSelf: "center",
  },
});

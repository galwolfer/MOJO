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
import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import { COLORS, SPACING, ICON_SIZES } from "../../theme";
import { ICONS } from "../../components/icons/icons";
import { useNavigation } from "../../context/NavigationContext";
import { useLayout } from "../../context/LayoutContext";
import { useTaskContext } from "../../context/TaskContext";
import DateSelector from "../../components/layout/DateSelector";
import CalendarPicker from "../../components/inputs/CalendarPicker";
import { getLocalDateString, stripTime } from "../../utils/dateUtils";
import EmptyState from "./components/EmptyState";
import TaskGroup from "./components/TaskGroup";
import FloatingButton from "../../components/common/FloatingButton";
import { useCalendarTasks } from "./hooks/useCalendarTasks";
import { Task } from "./types";

export default function CalendarScreen() {
  const { setHeaderConfig, setActiveTab, setActiveTabWithParams } = useNavigation();
  const { dimensions } = useLayout();
  const { notifyTaskUpdate, subscribeToTaskUpdates } = useTaskContext();

  const [selectedDate, setSelectedDate] = useState<Date>(() => stripTime(new Date()));
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showCalendarPicker, setShowCalendarPicker] = useState<boolean>(false);

  useEffect(() => {
    setSelectedDate(stripTime(new Date()));
  }, []);

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
          <ICONS.calendar size={ICON_SIZES.md} color={COLORS.primary1} />
        </TouchableOpacity>
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
  } = useCalendarTasks(selectedDate, notifyTaskUpdate, subscribeToTaskUpdates);

  const filteredTaskGroups = getFilteredTaskGroups();

  const handleAddTask = () => {
    setActiveTab("create");
  };

  const handleEditTask = (taskToEdit: Task) => {
    // taskToEdit.id is the session ID; taskToEdit.taskId is the actual task _id
    const actualTaskId = taskToEdit.taskId || taskToEdit.id;
    setActiveTabWithParams("edit" as any, { taskId: actualTaskId });
  };

  const handleTaskPress = (taskId: string) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  return (
    <View style={styles.container}>
      {/* Tasks List */}
      <ScrollView
        style={styles.tasksList}
        contentContainerStyle={[styles.tasksListContent, { paddingTop: dimensions.headerHeight + SPACING.md }]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary1} />
            <AppText variant="bodyText" style={{ color: COLORS.lightGray }}>
              Loading tasks...
            </AppText>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <AppText variant="boldText" style={{ color: COLORS.primary1, textAlign: "center" }}>
              Unable to Load Tasks
            </AppText>
            <AppText variant="bodyText" style={{ color: COLORS.darkGray, textAlign: "center" }}>
              {error}
            </AppText>
            <AppButton
              title="Retry"
              onPress={() => fetchTasksForDate(selectedDate)}
              mode="filled"
              color="primary1"
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
      </ScrollView>

      {/* Floating ADD Button - Always visible */}
      <FloatingButton onPress={handleAddTask} text="Add Task" Icon={ICONS.plus} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white3,
    position: "relative",
  },
  tasksList: {
    flex: 1,
    backgroundColor: COLORS.white3,
  },

  tasksListContent: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.xlg * 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SPACING.xlg,
    gap: SPACING.md,
  },
  errorContainer: {
    flex: 1,
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

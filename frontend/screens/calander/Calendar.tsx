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
import { View, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import { COLORS, SPACING } from "../../theme";
import { ICONS } from "../../components/icons/icons";
import { useNavigation } from "../../context/NavigationContext";
import { useTaskContext } from "../../context/TaskContext";
import CalendarHeader from "./components/CalendarHeader";
import EmptyState from "./components/EmptyState";
import TaskGroup from "./components/TaskGroup";
import FloatingButton from "../../components/common/FloatingButton";
import { useCalendarTasks } from "./hooks/useCalendarTasks";
import { Task } from "./types";
import { stripTime } from "../../utils/dateUtils";

export default function CalendarScreen() {
  const { setHeaderConfig, setActiveTab, setActiveTabWithParams } = useNavigation();
  const { notifyTaskUpdate, subscribeToTaskUpdates } = useTaskContext();

  const [selectedDate, setSelectedDate] = useState<Date>(() => stripTime(new Date()));
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showCalendarPicker, setShowCalendarPicker] = useState<boolean>(false);

  useEffect(() => {
    setSelectedDate(stripTime(new Date()));
  }, []);

  useEffect(() => {
    setHeaderConfig({
      show: false,
    });
  }, [setHeaderConfig]);

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
      {/* Header */}
      <CalendarHeader
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        showCalendarPicker={showCalendarPicker}
        setShowCalendarPicker={setShowCalendarPicker}
      />

      {/* Tasks List */}
      <ScrollView
        style={styles.tasksList}
        contentContainerStyle={styles.tasksListContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary1} />
            <AppText variant="bodyText" style={{ color: COLORS.lightGray }}>Loading tasks...</AppText>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <AppText variant="boldText" style={{ color: COLORS.primary1, textAlign: "center" }}>Unable to Load Tasks</AppText>
            <AppText variant="bodyText" style={{ color: COLORS.darkGray, textAlign: "center" }}>{error}</AppText>
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

      {/* Floating ADD Button */}
      {filteredTaskGroups.length > 0 && <FloatingButton onPress={handleAddTask} text="" Icon={ICONS.plus} style={styles.fab} />}
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
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  tasksListContent: {
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.md + SPACING.sm + SPACING.xs,
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

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
import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, ScrollView, Animated, ActivityIndicator, TouchableOpacity } from "react-native";
import AppText from "../../components/common/AppText";
import Header from "../../components/common/Header";
import { COLORS, SPACING, FONT_SIZES, FONTS, ICON_SIZES } from "../../theme";
import { ICONS } from "../../components/icons/icons";
import { useNavigation } from "../../context/NavigationContext";
import { useTaskContext } from "../../context/TaskContext";
import DateSelector from "../../components/layout/DateSelector";
import CalendarPicker from "../../components/inputs/CalendarPicker";
import EmptyState from "./components/EmptyState";
import TaskGroup from "./components/TaskGroup";
import FloatingActionButton from "./components/FloatingActionButton";
import { useCalendarTasks } from "./hooks/useCalendarTasks";
import { Task } from "./types";

export default function CalendarScreen() {
  const { setHeaderConfig, setActiveTab } = useNavigation();
  const { notifyTaskUpdate, subscribeToTaskUpdates } = useTaskContext();

  const stripTime = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const [selectedDate, setSelectedDate] = useState<Date>(() => stripTime(new Date()));
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showCalendarPicker, setShowCalendarPicker] = useState<boolean>(false);

  // Animation for Mojo logo rotation in empty state
  const rotationValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setSelectedDate(stripTime(new Date()));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const startRotation = () => {
      if (!isMounted) return;
      rotationValue.setValue(0);
      Animated.timing(rotationValue, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && isMounted) {
          startRotation();
        }
      });
    };

    startRotation();

    return () => {
      isMounted = false;
      rotationValue.stopAnimation();
    };
  }, [rotationValue, selectedDate]);

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
    console.log("Editing task:", taskToEdit);
    setActiveTab("edit" as any);
  };

  const handleTaskPress = (taskId: string) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header
        title="MY TASKS"
        show={true}
        leftElement={
          <TouchableOpacity
            onPress={() => setShowCalendarPicker(!showCalendarPicker)}
            activeOpacity={0.7}
            style={styles.calendarIconButton}
          >
            <ICONS.calendar size={ICON_SIZES.md} color={COLORS.primary1} />
          </TouchableOpacity>
        }
        element={
          showCalendarPicker ? (
            <CalendarPicker
              onDateSelect={(dateString) => {
                const date = new Date(dateString);
                setSelectedDate(date);
              }}
              selectedDate={getLocalDateString(selectedDate)}
              allowPastDates={true}
              allowPreviousMonths={true}
              lighterPastDates={true}
            />
          ) : (
            <DateSelector selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
          )
        }
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
            <AppText style={styles.loadingText}>Loading tasks...</AppText>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <AppText style={styles.errorTitle}>Unable to Load Tasks</AppText>
            <AppText style={styles.errorMessage}>{error}</AppText>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchTasksForDate(selectedDate)}
              activeOpacity={0.8}
            >
              <AppText style={styles.retryButtonText}>Retry</AppText>
            </TouchableOpacity>
          </View>
        ) : filteredTaskGroups.length === 0 ? (
          <EmptyState rotationValue={rotationValue} showCalendarPicker={showCalendarPicker} onAddTask={handleAddTask} />
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
      {filteredTaskGroups.length > 0 && <FloatingActionButton onPress={handleAddTask} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white3,
  },
  tasksList: {
    flex: 1,
    backgroundColor: COLORS.white3,
    zIndex: 1,
  },
  tasksListContent: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.xlg * 6,
    paddingTop: SPACING.md + SPACING.sm + SPACING.xs,
  },
  calendarIconButton: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SPACING.xlg,
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.lightGray,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xlg,
    gap: SPACING.md,
  },
  errorTitle: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary1,
    textAlign: "center",
  },
  errorMessage: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.darkGray,
    textAlign: "center",
    lineHeight: Math.round(FONT_SIZES.base * 1.4),
  },
  retryButton: {
    backgroundColor: COLORS.primary1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: SPACING.md,
    marginTop: SPACING.md,
  },
  retryButtonText: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.base,
    color: COLORS.colorWhite,
    textAlign: "center",
  },
});

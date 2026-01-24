import React, { useEffect, useRef, useState } from "react";

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
import { View, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform, Animated, ActivityIndicator } from "react-native";
import AppText from "../components/common/AppText";
import { COLORS, SPACING, FONT_SIZES, SHADOWS, TYPOGRAPHY, FONTS } from "../theme";
import { useNavigation } from "../context/NavigationContext";
import { ICONS } from "../components/icons/icons";
import { getCategoryMeta } from "../config/categoryMeta";
import { Checkbox } from "../components/icons/Checkbox.native";
import { ProgressIcon } from "../components/icons/ProgressIcon.native";
import DateSelector from "../components/layout/DateSelector";
import CalendarPicker from "../components/inputs/CalendarPicker";
import { getTasksForDate, getScheduledSessionsForDate, transformTasksToCalendarGroups, updateTask, toggleTaskCompletion, CalendarTaskGroup } from "../services/taskService";
import { useTaskContext } from "../context/TaskContext";

/**
 * Subtask interface
 */
interface Subtask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  timeRange?: string; // Time interval for scheduled sessions (e.g., "09:00 AM - 10:30 AM")
}

/**
 * Task interface with category support
 */
interface Task {
  id: string;
  time: string;
  endTime?: string;
  title: string;
  emoji: string;
  tags: string[];
  dueDate: string;
  description: string;
  completed: boolean;
  color: string;
  category?: string;
  subtasks?: Subtask[];
  dateString?: string; // Date in YYYY-MM-DD format for filtering
  partNumber?: number; // Part number for multi-day tasks
  totalParts?: number; // Total parts for multi-day tasks
  parentTaskName?: string; // Parent task name for multi-day subtasks
}

/**
 * TaskGroup interface for date-based organization
 */
interface TaskGroup {
  date: string;
  tasks: Task[];
}

/**
 * CalendarScreen Component
 *
 * Displays a calendar view with tasks organized by date. Each date group is
 * wrapped in a white rounded container. Tasks show a color bar, category icon,
 * and all relevant metadata (time, emoji, tags, subtasks, description).
 */
export default function CalendarScreen() {
  const { setHeaderConfig, setActiveTab } = useNavigation();
  const { notifyTaskUpdate, subscribeToTaskUpdates } = useTaskContext();

  const stripTime = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const [selectedDate, setSelectedDate] = useState<Date>(() => stripTime(new Date()));
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    setSelectedDate(stripTime(new Date()));
  }, []);

  // Animation for Mojo logo rotation
  const rotationValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotationValue, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, [rotationValue]);

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [completedSubtasks, setCompletedSubtasks] = useState<Set<string>>(new Set());
  const [showCalendarPicker, setShowCalendarPicker] = useState<boolean>(false);

  /**
   * Fetch both regular tasks and scheduled sessions from API for the selected date
   */
  const fetchTasksForDate = async (date: Date) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch both regular tasks and scheduled sessions in parallel
      const [taskGroups, scheduledGroups] = await Promise.all([
        getTasksForDate(date),
        getScheduledSessionsForDate(date)
      ]);
      
      // Merge scheduled sessions with regular tasks
      // If there are scheduled sessions for this date, show those instead
      // Otherwise show regular tasks
      if (scheduledGroups.length > 0) {
        setTaskGroups(scheduledGroups);
      } else {
        setTaskGroups(taskGroups);
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
      setError("Failed to load tasks. Please try again.");
      setTaskGroups([]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle task completion toggle
   * Persists to API and refreshes the UI
   */
  const handleTaskCompletionToggle = async (taskId: string, checked: boolean) => {
    try {
      // Optimistically update local state
      const newCompleted = new Set(completedTasks);
      const newSubtasksCompleted = new Set(completedSubtasks);
      
      if (checked) {
        newCompleted.add(taskId);
        // Check all subtasks
        const task = taskGroups
          .flatMap((g) => g.tasks)
          .find((t) => t.id === taskId);
        if (task?.subtasks) {
          task.subtasks.forEach((st) => newSubtasksCompleted.add(st.id));
        }
      } else {
        newCompleted.delete(taskId);
        // Uncheck all subtasks
        const task = taskGroups
          .flatMap((g) => g.tasks)
          .find((t) => t.id === taskId);
        if (task?.subtasks) {
          task.subtasks.forEach((st) => newSubtasksCompleted.delete(st.id));
        }
      }
      
      setCompletedTasks(newCompleted);
      setCompletedSubtasks(newSubtasksCompleted);
      
      // Persist to API
      await updateTask(taskId, {
        status: checked ? "done" : "todo",
        completed: checked,
      });
      
      // Notify other parts of app and refetch
      notifyTaskUpdate();
    } catch (err) {
      console.error("Failed to update task completion:", err);
      // Revert optimistic update on error
      fetchTasksForDate(selectedDate);
    }
  };

  /**
   * Handle subtask completion toggle
   * Persists to API via parent task update
   */
  const handleSubtaskCompletionToggle = async (
    taskId: string,
    subtaskId: string,
    checked: boolean
  ) => {
    try {
      // Optimistically update local state
      const newSubtasksCompleted = new Set(completedSubtasks);
      
      if (checked) {
        newSubtasksCompleted.add(subtaskId);
      } else {
        newSubtasksCompleted.delete(subtaskId);
      }
      
      setCompletedSubtasks(newSubtasksCompleted);
      
      // Find the task and update it with new subtask states
      const task = taskGroups
        .flatMap((g) => g.tasks)
        .find((t) => t.id === taskId);
      
      if (task?.subtasks) {
        // Note: Subtask completion is tracked locally in the UI
        // Backend will sync subtask states when we call getTasks() again
        
        // Persist to API - trigger a refetch on the backend
        await updateTask(taskId, {
          status: task.completed ? "done" : "todo",
        });
        
        // Notify other parts of app and refetch
        notifyTaskUpdate();
      }
    } catch (err) {
      console.error("Failed to update subtask completion:", err);
      // Revert optimistic update on error
      fetchTasksForDate(selectedDate);
    }
  };

  /**
   * Subscribe to task updates and refetch when tasks change elsewhere in the app
   */
  useEffect(() => {
    const unsubscribe = subscribeToTaskUpdates(() => {
      fetchTasksForDate(selectedDate);
    });
    return unsubscribe;
  }, [selectedDate, subscribeToTaskUpdates]);

  /**
   * Fetch tasks when component mounts or selected date changes
   */
  useEffect(() => {
    fetchTasksForDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    setHeaderConfig({
      show: false,
    });
  }, [setHeaderConfig]);

  const handleAddTask = () => {
    setActiveTab("create");
  };

  const handleEditTask = (taskToEdit: Task) => {
    // Navigate to EditTask screen
    // For now, we'll create a simple navigation by setting a modal state
    // In a production app, you'd use React Navigation with route params
    console.log("Editing task:", taskToEdit);
    setActiveTab("edit" as any);
  };

  /**
   * Convert local Date to YYYY-MM-DD string without UTC conversion
   * Fixes timezone offset bugs where selecting a date can shift by one day
   */
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /**
   * Get tasks filtered by selected date
   */
  const getFilteredTaskGroups = (): TaskGroup[] => {
    const selectedDateString = getLocalDateString(selectedDate);
    
    const filteredGroups: TaskGroup[] = [];
    
    taskGroups.forEach(group => {
      const matchingTasks = group.tasks.filter(task => task.dateString === selectedDateString);
      
      if (matchingTasks.length > 0) {
        filteredGroups.push({
          date: group.date,
          tasks: matchingTasks,
        });
      }
    });
    
    return filteredGroups;
  };

  const filteredTaskGroups = getFilteredTaskGroups();

  /**
   * Renders empty state when no tasks exist for selected date
   */
  const renderEmptyState = () => {
    const rotation = rotationValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
    <View style={[styles.emptyStateContainer, showCalendarPicker && styles.emptyStateContainerWithCalendar]}>
      <View style={styles.emptyStateContent}>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          {ICONS.bestojo && React.createElement(ICONS.bestojo, {
            size: 120,
            color: COLORS.primary1,
          })}
        </Animated.View>
        
        <AppText style={styles.emptyStateTitle}>No Tasks Today</AppText>
        
        <AppText style={styles.emptyStateDescription}>
          You have cleared your schedule!
        </AppText>
        
        <AppText style={styles.emptyStateSubtext}>
          Want to add a new task or goal for this day?
        </AppText>
        
        <TouchableOpacity 
          style={styles.emptyStateButton}
          activeOpacity={0.8}
          onPress={handleAddTask}
        >
          <AppText style={styles.emptyStateButtonText}>+ Add Task</AppText>
        </TouchableOpacity>
      </View>
    </View>
    );
  };

  /**
   * Calculate progress for a task with subtasks
   * Returns a value between 0 and 1 representing completion percentage
   */
  const getTaskProgress = (task: Task): number => {
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    const completedCount = task.subtasks.filter(s => completedSubtasks.has(s.id)).length;
    return completedCount / task.subtasks.length;
  };

  const renderSubtask = (subtask: Subtask, parentTaskId: string) => (
    <View key={subtask.id} style={styles.subtaskContainer}>
      <View style={styles.subtaskRow}>
        <Checkbox 
          checked={completedSubtasks.has(subtask.id)}
          onChange={(checked) => {
            handleSubtaskCompletionToggle(parentTaskId, subtask.id, checked);
          }}
          size={18}
        />
        <View style={{ flex: 1 }}>
          <AppText 
            variant="notes"
            style={[styles.subtaskText, completedSubtasks.has(subtask.id) && styles.subtaskTextCompleted]}
          >
            {subtask.title}
          </AppText>
          {subtask.timeRange && (
            <AppText 
              style={[styles.subtaskTimeRange, completedSubtasks.has(subtask.id) && styles.subtaskTimeRangeCompleted]}
            >
              {subtask.timeRange}
            </AppText>
          )}
        </View>
      </View>
      {subtask.description && (
        <AppText 
          style={[styles.subtaskDescription, completedSubtasks.has(subtask.id) && styles.subtaskDescriptionCompleted]}
        >
          {subtask.description}
        </AppText>
      )}
    </View>
  );

  /**
   * Handles task card press - toggles expand/collapse
   */
  const handleTaskPress = (taskId: string) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  /**
   * Renders compact task card (collapsed state) or expanded view (when clicked)
   */
  const renderTaskCardCompact = (task: Task) => {
    const categoryMeta = task.category ? getCategoryMeta(task.category) : null;
    const IconComponent = categoryMeta ? ICONS[categoryMeta.icon] : null;
    const isExpanded = expandedTaskId === task.id;

    // If expanded, show only the expanded view
    if (isExpanded) {
      return (
        <TouchableOpacity 
          key={`${task.id}-expanded`} 
          style={styles.taskExpandedContainer}
          onPress={() => handleTaskPress(task.id)}
          activeOpacity={0.9}
        >
          {/* Full-height color bar on the left */}
          <View style={[styles.expandedColorBarFull, { backgroundColor: categoryMeta?.color || task.color }]} />

          {/* Top-right edit button */}
          <TouchableOpacity 
            style={styles.expandedEditButtonTopRight}
            onPress={() => handleEditTask(task)}
          >
            <ICONS.edit size={18} color={COLORS.darkGray} />
          </TouchableOpacity>

          {/* Main layout: Left (time + endTime) + Right (all content) */}
          <View style={styles.expandedMainRow}>
            {/* Left side: Time and End Time */}
            <View style={styles.expandedLeftSection}>
              <AppText style={styles.expandedTime}>{task.time}</AppText>
              <View style={{ flex: 1 }} />
              {task.endTime && (
                <AppText style={styles.expandedEndTime}>{task.endTime}</AppText>
              )}
            </View>
            
            {/* Right side: All content */}
            <View style={styles.expandedRightSection}>
              {/* Title Row with Checkbox */}
              <View style={styles.expandedTitleRowInline}>
                <Checkbox 
                  checked={completedTasks.has(task.id)}
                  onChange={(checked) => {
                    handleTaskCompletionToggle(task.id, checked);
                  }}
                  size={24}
                />
                {IconComponent && categoryMeta && (
                  React.createElement(IconComponent, {
                    size: 20,
                    color: categoryMeta.color,
                  })
                )}
                <AppText style={styles.expandedTitleInline}>{task.title}</AppText>
              </View>

              {/* Part info for multi-day tasks (show in expanded view) */}
              {task.partNumber && task.totalParts && task.totalParts > 1 && task.subtasks?.length === 1 && (
                <AppText style={styles.expandedPartInfoText}>
                  Part {task.partNumber}/{task.totalParts} for {task.parentTaskName}
                </AppText>
              )}

              {/* Progress Circle and Tags Row */}
              <View style={styles.expandedProgressAndTagsRow}>
                {/* Tags */}
                {task.tags.length > 0 && (
                  <View style={styles.expandedTagsContainer}>
                    {task.tags.map((tag, idx) => (
                      <View key={idx} style={styles.expandedTag}>
                        {IconComponent && (
                          React.createElement(IconComponent, {
                            size: 12,
                            color: "#c70d5e",
                          })
                        )}
                        <AppText style={styles.expandedTagText}>{tag}</AppText>
                      </View>
                    ))}
                  </View>
                )}
                
                {/* Progress Circle for Subtasks */}
                {task.subtasks && task.subtasks.length > 0 && (
                  <ProgressIcon value={getTaskProgress(task)} size={24} />
                )}
              </View>

              {/* Due Date - Hide for scheduled sessions since subtasks show times */}
              {task.dueDate && !(task as any).isScheduled && (
                <AppText style={styles.expandedDueDate}>{task.dueDate}</AppText>
              )}

              {/* Main Task Description */}
              {(task as any).mainTaskDescription && (
                <AppText style={styles.expandedDescription}>{(task as any).mainTaskDescription}</AppText>
              )}

              {/* Description (Subtask description for multi-day, or task description) */}
              {task.description && (
                <AppText style={styles.expandedDescription}>{task.description}</AppText>
              )}

              {/* Subtasks */}
              {task.subtasks && task.subtasks.length > 0 && (
                <View style={styles.expandedSubtasksContainer}>
                  {task.subtasks.map((subtask) => renderSubtask(subtask, task.id))}
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Otherwise, show compact view
    return (
      <TouchableOpacity 
        key={`${task.id}-compact`}
        style={styles.taskCardCompact}
        onPress={() => handleTaskPress(task.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.taskColorBarCompact, { backgroundColor: categoryMeta?.color || task.color }]} />
        
        <View style={styles.taskCompactLeft}>
          <AppText style={styles.taskTimeCompact}>{task.time}</AppText>
          {task.endTime && (
            <AppText style={styles.taskTimeSeparatorCompact}>{task.endTime}</AppText>
          )}
        </View>

        {/* Check if this is a multi-day task with subtasks - if so, use new layout; otherwise use simple layout */}
        {task.subtasks && task.subtasks.length > 0 && task.partNumber && task.totalParts && task.totalParts > 1 ? (
          // Multi-day subtask layout
          <View style={styles.taskCompactMiddle}>
            <View style={styles.taskTitleRowCompact}>
              <Checkbox 
                checked={completedTasks.has(task.id)}
                onChange={(checked) => {
                  handleTaskCompletionToggle(task.id, checked);
                }}
                size={20}
              />
              {IconComponent && categoryMeta && (
                React.createElement(IconComponent, {
                  size: 18,
                  color: categoryMeta.color,
                })
              )}
              <AppText style={styles.taskTitleCompact}>{task.title}</AppText>
            </View>

            {/* Subtasks - Display individual subtasks with checkboxes */}
            {task.subtasks && task.subtasks.length > 0 && (
              <View style={styles.subtasksContainerCompact}>
                {task.subtasks.map((subtask) => (
                  <View key={subtask.id} style={styles.subtaskRowCompact}>
                    <Checkbox 
                      checked={completedSubtasks.has(subtask.id)}
                      onChange={(checked) => {
                        handleSubtaskCompletionToggle(task.id, subtask.id, checked);
                      }}
                      size={16}
                    />
                    <View style={{flex: 1}}>
                      <AppText style={[styles.subtaskTextCompact, completedSubtasks.has(subtask.id) && styles.subtaskTextCompactCompleted]}>
                        {subtask.title}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          // Simple single-task layout (no subtasks or single-day task)
          <View style={styles.taskCompactMiddle}>
            <View style={styles.taskTitleRowCompact}>
              <Checkbox 
                checked={completedTasks.has(task.id)}
                onChange={(checked) => {
                  handleTaskCompletionToggle(task.id, checked);
                }}
                size={20}
              />
              {IconComponent && categoryMeta && (
                React.createElement(IconComponent, {
                  size: 18,
                  color: categoryMeta.color,
                })
              )}
              <AppText style={styles.taskTitleCompact}>{task.title}</AppText>
            </View>
          </View>
        )}

        <View style={styles.taskCompactRight}>
          {task.subtasks && task.subtasks.length > 0 && (
            <ProgressIcon value={getTaskProgress(task)} size={24} />
          )}
          <TouchableOpacity onPress={() => handleEditTask(task)}>
            {IconComponent && categoryMeta && (
              <View style={[styles.categoryIconContainerCompact, { backgroundColor: categoryMeta.color }]}>
                {React.createElement(IconComponent, {
                  size: 16,
                  color: COLORS.colorWhite,
                })}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Renders a task card with all metadata
   */
  const renderTaskCard = (task: Task, isLast = false) => {
    const categoryMeta = task.category ? getCategoryMeta(task.category) : null;
    const IconComponent = categoryMeta ? ICONS[categoryMeta.icon] : null;

    return (
      <View key={task.id} style={[styles.taskCard, isLast && styles.taskCardLast]}>
        <View style={[styles.taskColorBar, { backgroundColor: task.color }]} />
        <View style={styles.taskContent}>
          <View style={styles.taskHeader}>
            <View style={styles.taskTimeContainer}>
              <AppText style={styles.taskTime}>{task.time}</AppText>
              {task.endTime && (
                <>
                  <AppText style={styles.taskTimeSeparator}>-</AppText>
                  <AppText style={styles.taskTime}>{task.endTime}</AppText>
                </>
              )}
            </View>
            <View style={styles.taskActions}>
              <TouchableOpacity style={styles.checkbox}>
                <View style={styles.checkboxInner} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.editButton}>
                <ICONS.edit size={18} color={COLORS.darkGray} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.taskTitleRow}>
            <AppText style={styles.taskEmoji}>{task.emoji}</AppText>
            <AppText style={styles.taskTitle}>{task.title}</AppText>
          </View>
          
          {task.subtasks && task.subtasks.length > 0 && (
            <View style={styles.subtasksContainer}>
              {task.subtasks.map((subtask) => renderSubtask(subtask, task.id))}
            </View>
          )}
          
          {task.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {task.tags.map((tag, idx) => (
                <View key={idx} style={styles.tag}>
                  <ICONS.heart size={12} color="#C2185B" />
                  <AppText style={styles.tagText}>{tag}</AppText>
                </View>
              ))}
            </View>
          )}
          
          {task.dueDate && <AppText variant="notes" style={styles.dueDate}>{task.dueDate}</AppText>}
          {task.description && <AppText variant="bodyText" style={styles.description}>{task.description}</AppText>}
        </View>

        {/* Category Icon on the right (small circular badge) */}
        {IconComponent && categoryMeta && (
          <View style={[styles.categoryIconContainer, { backgroundColor: categoryMeta.color }]}>
            {React.createElement(IconComponent, {
              size: 18,
              color: COLORS.colorWhite,
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Title and Day Selector */}
      <View style={styles.headerWrapper}>
        {/* OUTER: shadow only (must NOT be overflow hidden) */}
        <View style={styles.headerOuterShadow}>
          {/* INNER: rounded + clip */}
          <View style={styles.headerInnerClip}>
            <View style={styles.headerCard}>
              <View style={styles.headerTitleRow}>
                <TouchableOpacity 
                  style={styles.headerIcon}
                  onPress={() => setShowCalendarPicker(!showCalendarPicker)}
                  activeOpacity={0.7}
                >
                  <ICONS.calendar size={28} color={COLORS.primary1} />
                </TouchableOpacity>
                <AppText style={styles.headerTitle}>MY TASKS</AppText>
              </View>

              {showCalendarPicker ? (
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
              )}
            </View>
          </View>
        </View>
      </View>


      {/* Tasks List - Using Compact Cards */}
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
          renderEmptyState()
        ) : (
          filteredTaskGroups.map((group, groupIdx) => (
            <View key={groupIdx} style={styles.dayGroupContainer}>
            {/* Tasks for this date - wrapped in container with date header inside */}
            <View style={styles.tasksGroupWrapper}>
              <View style={styles.dateHeaderInWrapper}>
                <AppText style={styles.dateHeaderTextInWrapper}>{group.date}</AppText>
              </View>

              <View style={styles.tasksInner}>
                {group.tasks.map((task) => renderTaskCardCompact(task))}
              </View>
            </View>
          </View> 
        ))
        )}
      </ScrollView>

      {/* Floating ADD Button - Show only when there are tasks */}
      {filteredTaskGroups.length > 0 && (
        <TouchableOpacity
          style={styles.floatingButton}
          activeOpacity={0.8}
          onPress={handleAddTask}
        >
          <AppText style={styles.floatingButtonText}>+</AppText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white3,
  },
  headerWrapper: {
    backgroundColor: COLORS.white3,
    overflow: "visible",
    paddingBottom: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontFamily: FONTS.fredokaBold,
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary1,
    fontWeight: "600",
    paddingTop: 0,
  },

  headerCard: {
    backgroundColor: COLORS.colorWhite,
    width: "100%",

    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,

    paddingTop: Platform.OS === "android"
      ? (StatusBar.currentHeight ?? 0) + 6
      : 44,

    paddingHorizontal: SPACING.sm,
    paddingBottom: 0,
  },
  headerShadow: {
    // shadow only
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,

    // חשוב: לא לחתוך צל
    overflow: "visible",
  },
  headerIcon: {
    marginTop: 0,
    marginRight: SPACING.sm,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  tasksList: {
    flex: 1,
    backgroundColor: COLORS.white3,
    zIndex: 1,
    marginTop: -32,
  },
  tasksListContent: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingBottom: 160,
    paddingTop: 24 + (SPACING.md - 16),
  },
  dayGroupContainer: {
    marginBottom: SPACING.md,
  },
  dateHeaderInWrapper: {
    backgroundColor: COLORS.primary1,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    paddingLeft: SPACING.md,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dateHeaderTextInWrapper: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.base,
    color: COLORS.colorWhite,
    textAlign: "center",
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  tasksInner: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    paddingLeft: 0,
  },
  tasksGroupWrapper: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: 16,
    overflow: "hidden",
    marginHorizontal: 0,
    marginTop: 0,
    padding: 0,
    marginLeft: 5,
    marginRight: 5,
    ...(SHADOWS.card as object),
  },
  taskCard: {
    flexDirection: "row",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingLeft: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
    backgroundColor: COLORS.colorWhite,
    alignItems: "flex-start",
  },
  taskCardLast: {
    borderBottomWidth: 0,
  },
  taskColorBar: {
    width: 4,
    marginRight: SPACING.md,
    marginVertical: 0,
  },
  taskContent: {
    flex: 1,
    paddingVertical: 0,
    paddingLeft: 0,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  taskTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  taskTime: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
  },
  taskTimeSeparator: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
  },
  taskActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: COLORS.primary1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxInner: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  editButton: {
    padding: 2,
  },
  taskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  taskEmoji: {
    fontSize: 18,
    fontFamily: FONTS.fredokaRegular,
  },
  taskTitle: {
    fontFamily: FONTS.fredokaRegular,
    flex: 1,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
    fontWeight: "600",
    lineHeight: 20,
  },
  tagText: {
    fontFamily: FONTS.fredokaRegular,
    color: "#C2185B",
    fontSize: FONT_SIZES.sm,
    fontWeight: "500",
  },
  dueDate: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    marginBottom: 4,
  },
  description: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    fontWeight: "400",
    lineHeight: 18,
  },
  categoryIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: SPACING.md,
    alignSelf: "center",
    elevation: 2,
  },
  subtasksContainer: {
    marginLeft: 0,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
    paddingLeft: SPACING.lg,
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  subtaskContainer: {
    gap: 4,
  },
  subtaskText: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
    fontWeight: "400",
  },
  subtaskTimeRange: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    fontWeight: "400",
    marginTop: 2,
  },
  subtaskTimeRangeCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  subtaskDescription: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    marginLeft: 26,
    lineHeight: 16,
  },
  subtaskTextCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  subtaskDescriptionCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  subtaskCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
  },
  subtaskCheckboxChecked: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  subtaskCheckmark: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.colorWhite,
    fontWeight: "700",
    fontFamily: FONTS.fredokaRegular,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFE0EC",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  floatingButton: {
    position: "absolute",
    bottom: 120,
    right: SPACING.lg,
    backgroundColor: "#2ecc71",
    borderRadius: 50,
    width: 56,
    height: 56,
    paddingHorizontal: 0,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 0,
    zIndex: 99,
    ...(SHADOWS.card as object),
  },
  floatingButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 24,
    textAlign: "center",
    fontFamily: FONTS.fredokaRegular,
    paddingHorizontal: 0,
  },
  // ===== EMPTY STATE STYLES =====
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
  },
  emptyStateContainerWithCalendar: {
    marginTop: -80,
  },
  emptyStateContent: {
    alignItems: "center",
    gap: SPACING.lg,
  },
  emptyStateTitle: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary1,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyStateDescription: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.darkGray,
    fontWeight: "500",
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  emptyStateButton: {
    backgroundColor: "#2ecc71",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    marginTop: SPACING.md,
    ...SHADOWS.card,
  },
  emptyStateButtonText: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.base,
    color: COLORS.white,
    fontWeight: "600",
    textAlign: "center",
  },
  // ===== COMPACT TASK CARD STYLES =====
  taskCardCompact: {
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: SPACING.md,
    paddingLeft: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
    backgroundColor: "#edeffd",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  taskColorBarCompact: {
    width: 4,
    height: 60,
    borderRadius: 2,
  },
  taskCompactLeft: {
    justifyContent: "center",
    alignItems: "flex-start",
    minWidth: 45,
  },
  taskTimeCompact: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    lineHeight: 16,
  },
  taskTimeSeparatorCompact: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    lineHeight: 16,
    marginTop: SPACING.xlg,
  },
  taskCompactMiddle: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  taskTitleRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
    flexWrap: "nowrap",
    minWidth: 0,
  },
  taskEmojiCompact: {
    fontSize: 18,
    fontFamily: FONTS.fredokaRegular,
  },
  taskTitleCompact: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
    fontWeight: "600",
    lineHeight: 20,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  partInfoText: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    marginTop: 2,
    marginLeft: 38, // Align with text after checkbox/icon
  },
  subtasksContainerCompact: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
    paddingLeft: SPACING.md,
  },
  subtaskRowCompact: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  subtaskContentCompact: {
    flex: 1,
    gap: 2,
  },
  subtaskTextCompact: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.black,
    fontWeight: "400",
  },
  subtaskTextCompactCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  subtaskDescriptionCompact: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    marginTop: 2,
  },
  subtaskDescriptionCompactCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  subtaskSubtitleCompact: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    fontWeight: "500",
    marginTop: 2,
  },
  expandedSubtaskTitle: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    fontWeight: "600",
    marginTop: 4,
  },
  subtaskTimeRangeCompact: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    fontWeight: "400",
  },
  subtaskTimeRangeCompactCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.lightGray,
  },
  taskCompactRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  categoryIconContainerCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  heartButton: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  // ===== EXPANDED TASK STYLES (INLINE) =====
  taskExpandedContainer: {
    backgroundColor: COLORS.colorWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingLeft: SPACING.md + 8, // Add extra padding for the bar
    position: "relative",
  },
  expandedColorBarFull: {
    position: "absolute",
    left: SPACING.sm,
    top: SPACING.md,
    bottom: SPACING.md,
    width: 4,
    borderRadius: 2,
  },
  expandedEditButtonTopRight: {
    position: "absolute",
    top: SPACING.md,
    right: SPACING.md,
    padding: 4,
    zIndex: 10,
  },
  expandedMainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  expandedLeftSection: {
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    minWidth: 40,
    justifyContent: "space-between",
  },
  expandedTime: {
    fontFamily: FONTS.fredokaBold,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "600",
  },
  expandedEndTime: {
    fontFamily: FONTS.fredokaBold,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "600",
  },
  expandedRightSection: {
    flex: 1,
    gap: SPACING.sm,
  },
  expandedTitleRowInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    flexWrap: "wrap",
  },
  expandedProgressAndTagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  expandedProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  expandedEmojiInline: {
    fontSize: 18,
    fontFamily: FONTS.fredokaRegular,
  },
  expandedTitleInline: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
    fontWeight: "600",
    lineHeight: 20,
    flex: 1,
    flexWrap: "wrap",
  },
  expandedTagsContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  expandedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFE0EC",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  expandedTagText: {
    fontFamily: FONTS.fredokaRegular,
    color: "#C2185B",
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  expandedDueDate: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "600",
  },
  expandedDescription: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    fontWeight: "400",
    lineHeight: 18,
  },
  expandedPartInfoText: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    marginTop: 2,
  },
  expandedSubtasksContainer: {
    gap: SPACING.sm,
    paddingLeft: SPACING.md,
  },
  expandedBottomActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  expandedEndTimeContainer: {
    position: "absolute",
    bottom: SPACING.md,
    left: SPACING.sm,
    marginLeft: 8,
  },
  // ===== MODAL STYLES (KEPT FOR REFERENCE, NOT USED) =====
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  taskDetailContainer: {
    backgroundColor: COLORS.colorWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingBottom: 20,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  closeButton: {
    alignSelf: "flex-end",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  closeButtonText: {
    fontSize: 20,
    color: COLORS.darkGray,
    fontWeight: "600",
  },
  detailColorBar: {
    height: 4,
    width: "30%",
    borderRadius: 2,
    marginBottom: SPACING.md,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.md,
  },
  detailTimeSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailTime: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
  },
  detailEndTime: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
  },
  detailRightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  categoryIconContainerDetail: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  heartButtonDetail: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  detailTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailEmoji: {
    fontSize: 24,
    fontFamily: FONTS.fredokaRegular,
  },
  detailTitle: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.lg,
    color: COLORS.black,
    fontWeight: "700",
    lineHeight: 24,
    flex: 1,
  },
  detailTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFE0EC",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detailTagText: {
    fontFamily: FONTS.fredokaRegular,
    color: "#C2185B",
    fontSize: FONT_SIZES.sm,
    fontWeight: "500",
  },
  detailDueDate: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.lightGray,
    fontWeight: "400",
    marginBottom: SPACING.sm,
  },
  detailDescription: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.darkGray,
    fontWeight: "400",
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  detailSubtasksContainer: {
    marginBottom: SPACING.md,
    gap: SPACING.sm,
    paddingLeft: SPACING.md,
  },
  detailCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.primary1,
    alignItems: "center",
    justifyContent: "center",
  },
  detailCheckboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  detailActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.white2,
  },
  detailEditButton: {
    padding: 4,
  },
  selectedDot: {
    marginTop: 6,
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.white,
  },
  headerOuterShadow: {
    marginBottom: 14,
    backgroundColor: COLORS.colorWhite,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,

    position: "relative", // חשוב לאנדרואיד כדי ש-zIndex יעבוד
    zIndex: 50,
    elevation: 50,

    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },

    overflow: "visible",
  },

  headerInnerClip: {
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,

    // IMPORTANT: clip content corners ONLY here
    overflow: "hidden",
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
    fontWeight: "500",
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
    fontWeight: "600",
    textAlign: "center",
  },

  errorMessage: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.darkGray,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 20,
  },

  retryButton: {
    backgroundColor: COLORS.primary1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    marginTop: SPACING.md,
  },

  retryButtonText: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.base,
    color: COLORS.colorWhite,
    fontWeight: "600",
    textAlign: "center",
  },

});
